import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { getManagedNodeNpmBinPath } from "../runtime-paths.js";
import { ensureManagedNodeNpmInvocation, resolveManagedNodeNpmInvocation } from "./managed-node-runtime.js";

const execFile = promisify(execFileCallback);

async function createFakeNodeArchive(root: string, version: string): Promise<string> {
  const distName = `node-v${version}-darwin-${process.arch === "x64" ? "x64" : "arm64"}`;
  const distRoot = join(root, distName);
  const binDir = join(distRoot, "bin");
  const archivePath = join(root, `${distName}.tar.gz`);

  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(binDir, "node"),
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "v${version}"
  exit 0
fi
script="$1"
shift
exec /bin/sh "$script" "$@"
`
  );
  await writeFile(
    join(binDir, "npm"),
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "10.9.0"
  exit 0
fi
echo "$@" > "${root}/npm-args.txt"
`
  );
  await chmod(join(binDir, "node"), 0o755);
  await chmod(join(binDir, "npm"), 0o755);
  await execFile("/usr/bin/tar", ["-czf", archivePath, "-C", root, distName]);

  return archivePath;
}

test("ensureManagedNodeNpmInvocation installs npm under the ChillClaw runtime", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "chillclaw-managed-node-test-"));
  const dataDir = join(tempDir, "data");
  const version = "99.0.0";
  const archivePath = await createFakeNodeArchive(tempDir, version);
  const originalDataDir = process.env.CHILLCLAW_DATA_DIR;
  const originalNodeVersion = process.env.CHILLCLAW_MANAGED_NODE_VERSION;
  const originalNodeUrl = process.env.CHILLCLAW_MANAGED_NODE_DIST_URL;

  process.env.CHILLCLAW_DATA_DIR = dataDir;
  process.env.CHILLCLAW_MANAGED_NODE_VERSION = version;
  process.env.CHILLCLAW_MANAGED_NODE_DIST_URL = pathToFileURL(archivePath).href;

  try {
    assert.equal(await resolveManagedNodeNpmInvocation(), undefined);

    const invocation = await ensureManagedNodeNpmInvocation();

    assert.equal(invocation.command, getManagedNodeNpmBinPath());
    assert.equal(invocation.argsPrefix.length, 0);
    assert.equal(invocation.display, getManagedNodeNpmBinPath());

    await execFile(invocation.command, ["install", "--prefix", join(tempDir, "openclaw-runtime"), "openclaw@latest"]);
    assert.equal(await readFile(join(tempDir, "npm-args.txt"), "utf8"), "install --prefix " + join(tempDir, "openclaw-runtime") + " openclaw@latest\n");
  } finally {
    if (originalDataDir === undefined) {
      delete process.env.CHILLCLAW_DATA_DIR;
    } else {
      process.env.CHILLCLAW_DATA_DIR = originalDataDir;
    }
    if (originalNodeVersion === undefined) {
      delete process.env.CHILLCLAW_MANAGED_NODE_VERSION;
    } else {
      process.env.CHILLCLAW_MANAGED_NODE_VERSION = originalNodeVersion;
    }
    if (originalNodeUrl === undefined) {
      delete process.env.CHILLCLAW_MANAGED_NODE_DIST_URL;
    } else {
      process.env.CHILLCLAW_MANAGED_NODE_DIST_URL = originalNodeUrl;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});
