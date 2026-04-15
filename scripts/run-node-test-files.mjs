import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TEST_FILE_SUFFIX = ".test.";
const MAX_FAILURE_OUTPUT_LENGTH = 20_000;

export async function listTestFiles(rootDir) {
  const root = resolve(rootDir);
  const files = [];

  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          await visit(path);
          return;
        }
        if (entry.isFile() && entry.name.includes(TEST_FILE_SUFFIX)) {
          files.push(path);
        }
      })
    );
  }

  await visit(root);
  return files.sort();
}

function appendOutputTail(current, chunk) {
  const next = current + chunk;
  if (next.length <= MAX_FAILURE_OUTPUT_LENGTH) {
    return next;
  }
  return next.slice(-MAX_FAILURE_OUTPUT_LENGTH);
}

function escapeWorkflowCommandValue(value) {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export function formatGithubErrorAnnotation(filePath, cwd, outputTail) {
  const normalizedPath = relative(cwd, filePath) || filePath;
  const message = outputTail.trim() || "Node test file exited with a failure status.";
  return `::error file=${normalizedPath},title=Node test file failed::${escapeWorkflowCommandValue(message)}`;
}

function runTestFile(file, nodeArgs) {
  return new Promise((resolveRun) => {
    let outputTail = "";
    let settled = false;
    const child = spawn(process.execPath, [...nodeArgs, "--test", file], {
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"]
    });

    function settle(result) {
      if (settled) {
        return;
      }
      settled = true;
      resolveRun(result);
    }

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      outputTail = appendOutputTail(outputTail, String(chunk));
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      outputTail = appendOutputTail(outputTail, String(chunk));
    });

    child.on("error", (error) => {
      settle({
        file,
        ok: false,
        outputTail: String(error.stack ?? error)
      });
    });

    child.on("close", (code, signal) => {
      if (signal) {
        settle({
          file,
          ok: false,
          outputTail: appendOutputTail(outputTail, `\nNode test process ended with signal ${signal}.`)
        });
        return;
      }

      settle({
        file,
        ok: code === 0,
        outputTail
      });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const rootDir = args.at(-1) ?? "src";
  const nodeArgs = args.slice(0, -1);
  const files = await listTestFiles(rootDir);

  if (files.length === 0) {
    throw new Error(`No Node test files found under ${resolve(rootDir)}.`);
  }

  const failures = [];
  for (const file of files) {
    const result = await runTestFile(file, nodeArgs);
    if (!result.ok) {
      failures.push(result);
      if (process.env.GITHUB_ACTIONS === "true") {
        console.error(formatGithubErrorAnnotation(result.file, process.cwd(), result.outputTail));
      }
    }
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
