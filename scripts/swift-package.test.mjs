import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveSwiftPackageInvocation } from "./swift-package.mjs";

test("swift package wrapper canonicalizes symlinked package paths and isolates CLI scratch output", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "chillclaw-swift-package-"));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const realRoot = join(tempDir, "real-root");
  const packageDir = join(realRoot, "apps", "macos-native");
  await mkdir(packageDir, { recursive: true });

  const aliasParent = join(tempDir, "alias-parent");
  await mkdir(aliasParent, { recursive: true });

  const aliasRoot = join(aliasParent, "repo");
  await symlink(realRoot, aliasRoot, "dir");
  const canonicalRoot = await realpath(realRoot);
  const canonicalPackageDir = join(canonicalRoot, "apps", "macos-native");

  const invocation = await resolveSwiftPackageInvocation({
    cwd: aliasRoot,
    subcommand: "build",
    packagePath: "apps/macos-native",
    forwardedArgs: ["-c", "release", "--product", "ChillClawNative"]
  });

  assert.equal(invocation.cwd, canonicalRoot);
  assert.equal(invocation.packagePath, canonicalPackageDir);
  assert.equal(invocation.scratchPath, join(canonicalPackageDir, ".build", "cli"));
  assert.deepEqual(invocation.args, [
    "build",
    "--package-path",
    canonicalPackageDir,
    "--scratch-path",
    join(canonicalPackageDir, ".build", "cli"),
    "-c",
    "release",
    "--product",
    "ChillClawNative"
  ]);
});
