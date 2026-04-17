import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("runtime update feed builder emits a pinned OpenClaw npm package manifest", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "chillclaw-runtime-feed-test-"));
  const manifestPath = join(tempDir, "runtime-manifest.lock.json");
  const packageJsonPath = join(tempDir, "package.json");
  const outputPath = join(tempDir, "runtime-update.json");

  await writeFile(
    packageJsonPath,
    JSON.stringify({
      version: "0.2.0"
    })
  );
  await writeFile(
    manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-04-17T00:00:00.000Z",
      resources: [
        {
          id: "openclaw-runtime",
          kind: "engine",
          label: "OpenClaw runtime",
          version: "2026.4.18",
          platforms: [
            {
              os: "darwin",
              arch: "*"
            }
          ],
          sourcePolicy: ["bundled"],
          updatePolicy: "stage-silently-apply-safely",
          installDir: "openclaw-runtime",
          activePath: "openclaw-runtime/node_modules/.bin/openclaw",
          artifacts: [
            {
              source: "bundled",
              format: "directory",
              path: "openclaw/openclaw-runtime"
            }
          ],
          dependencies: ["node-npm-runtime"]
        }
      ]
    })
  );

  await execFileAsync(process.execPath, [
    "scripts/build-runtime-update-feed.mjs",
    "--manifest",
    manifestPath,
    "--package-json",
    packageJsonPath,
    "--output",
    outputPath,
    "--release-notes-url",
    "https://github.com/Jian130/chillclaw/releases/tag/v0.2.0"
  ]);

  const feed = JSON.parse(await readFile(outputPath, "utf8"));

  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.resources.length, 1);
  assert.deepEqual(feed.resources[0], {
    id: "openclaw-runtime",
    kind: "engine",
    label: "OpenClaw runtime",
    version: "2026.4.18",
    platforms: [
      {
        os: "darwin",
        arch: "*"
      }
    ],
    sourcePolicy: ["download"],
    updatePolicy: "stage-silently-apply-safely",
    installDir: "openclaw-runtime",
    activePath: "openclaw-runtime/node_modules/.bin/openclaw",
    artifacts: [
      {
        source: "download",
        format: "npm-package",
        package: "openclaw",
        version: "2026.4.18"
      }
    ],
    dependencies: ["node-npm-runtime"],
    minimumChillClawVersion: "0.2.0",
    channel: "stable",
    releaseNotesUrl: "https://github.com/Jian130/chillclaw/releases/tag/v0.2.0"
  });
});
