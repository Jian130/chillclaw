import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TEST_FILE_SUFFIX = ".test.";

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

async function main() {
  const args = process.argv.slice(2);
  const rootDir = args.at(-1) ?? "src";
  const nodeArgs = args.slice(0, -1);
  const files = await listTestFiles(rootDir);

  if (files.length === 0) {
    throw new Error(`No Node test files found under ${resolve(rootDir)}.`);
  }

  const child = spawn(process.execPath, [...nodeArgs, "--test", ...files], {
    env: process.env,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
