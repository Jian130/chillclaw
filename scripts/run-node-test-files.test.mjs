import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { formatGithubErrorAnnotation, listTestFiles } from "./run-node-test-files.mjs";

test("node test file runner lists root and nested tests without shell glob expansion", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "chillclaw-node-test-files-"));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await mkdir(join(tempDir, "src", "services"), { recursive: true });
  await mkdir(join(tempDir, "src", "runtime-manager", "helpers"), { recursive: true });
  await writeFile(join(tempDir, "src", "server.test.ts"), "");
  await writeFile(join(tempDir, "src", "services", "state-store.test.ts"), "");
  await writeFile(join(tempDir, "src", "runtime-manager", "helpers", "deep.test.ts"), "");
  await writeFile(join(tempDir, "src", "services", "not-a-test.ts"), "");

  assert.deepEqual(await listTestFiles(join(tempDir, "src")), [
    join(tempDir, "src", "runtime-manager", "helpers", "deep.test.ts"),
    join(tempDir, "src", "server.test.ts"),
    join(tempDir, "src", "services", "state-store.test.ts")
  ]);
});

test("node test file runner formats GitHub annotations with escaped failure output", () => {
  const annotation = formatGithubErrorAnnotation(
    "/repo/apps/daemon/src/services/example.test.ts",
    "/repo",
    "not ok 3 - example\nexpected 100% ready\r\nactual timeout"
  );

  assert.equal(
    annotation,
    "::error file=apps/daemon/src/services/example.test.ts,title=Node test file failed::not ok 3 - example%0Aexpected 100%25 ready%0D%0Aactual timeout"
  );
});
