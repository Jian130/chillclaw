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

test("node test file runner annotates the failing TAP block instead of later passing output", () => {
  const annotation = formatGithubErrorAnnotation(
    "/repo/apps/daemon/src/engine/openclaw-adapter.test.ts",
    "/repo/apps/daemon",
    [
      "# Subtest: failing setup path",
      "not ok 14 - failing setup path",
      "  ---",
      "  duration_ms: 12.5",
      "  failureType: 'testCodeFailure'",
      "  error: 'expected install command to run'",
      "  code: 'ERR_ASSERTION'",
      "  ...",
      "# Subtest: later passing route",
      "ok 61 - later passing route",
      "  ---",
      "  duration_ms: 0.5",
      "  ..."
    ].join("\n")
  );

  assert.equal(
    annotation,
    "::error file=src/engine/openclaw-adapter.test.ts,title=Node test file failed::not ok 14 - failing setup path%0A  ---%0A  duration_ms: 12.5%0A  failureType: 'testCodeFailure'%0A  error: 'expected install command to run'%0A  code: 'ERR_ASSERTION'%0A  ..."
  );
});
