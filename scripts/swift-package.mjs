#!/usr/bin/env node

import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function usage(message) {
  const prefix = message ? `${message}\n` : "";
  return `${prefix}Usage: node ./scripts/swift-package.mjs <swift-subcommand> --package-path <path> [swift args...]`;
}

function parseCliArgs(argv) {
  const [subcommand, ...rawArgs] = argv;

  if (!subcommand) {
    throw new Error(usage("Missing Swift subcommand."));
  }

  let packagePath = null;
  const forwardedArgs = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--package-path") {
      packagePath = rawArgs[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--package-path=")) {
      packagePath = arg.slice("--package-path=".length);
      continue;
    }

    if (arg === "--scratch-path" || arg.startsWith("--scratch-path=")) {
      throw new Error(usage("The wrapper manages --scratch-path automatically."));
    }

    forwardedArgs.push(arg);
  }

  if (!packagePath) {
    throw new Error(usage("Missing --package-path."));
  }

  return { subcommand, packagePath, forwardedArgs };
}

export async function resolveSwiftPackageInvocation({
  cwd = process.cwd(),
  subcommand,
  packagePath,
  forwardedArgs = []
}) {
  const realCwd = await realpath(cwd);
  const realPackagePath = await realpath(resolve(realCwd, packagePath));
  const scratchPath = resolve(realPackagePath, ".build", "cli");

  return {
    command: "swift",
    cwd: realCwd,
    packagePath: realPackagePath,
    scratchPath,
    args: [
      subcommand,
      "--package-path",
      realPackagePath,
      "--scratch-path",
      scratchPath,
      ...forwardedArgs
    ]
  };
}

async function main() {
  try {
    const { subcommand, packagePath, forwardedArgs } = parseCliArgs(process.argv.slice(2));
    const invocation = await resolveSwiftPackageInvocation({
      cwd: process.cwd(),
      subcommand,
      packagePath,
      forwardedArgs
    });

    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      stdio: "inherit",
      env: process.env
    });

    child.on("error", (error) => {
      console.error(error.message);
      process.exit(1);
    });

    child.on("exit", (code) => {
      process.exit(code ?? 1);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
