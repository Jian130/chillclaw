#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { writeScriptLogLine } from "./logging.mjs";

const ROOT = process.cwd();
const DEFAULT_REPOSITORY = "Jian130/chillclaw";
const DEFAULT_OUTPUT = resolve(ROOT, "dist/macos/runtime-update.json");
const SCRIPT_LABEL = "ChillClaw runtime update feed";

function parseArgs(argv) {
  const options = {
    manifestPath: resolve(ROOT, "runtime-manifest.lock.json"),
    packageJsonPath: resolve(ROOT, "package.json"),
    outputPath: DEFAULT_OUTPUT,
    channel: "stable",
    releaseNotesUrl: undefined
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--manifest" && next) {
      options.manifestPath = resolve(ROOT, next);
      index += 1;
    } else if (arg === "--package-json" && next) {
      options.packageJsonPath = resolve(ROOT, next);
      index += 1;
    } else if (arg === "--output" && next) {
      options.outputPath = resolve(ROOT, next);
      index += 1;
    } else if (arg === "--channel" && next) {
      options.channel = next.trim() || "stable";
      index += 1;
    } else if (arg === "--release-notes-url" && next) {
      options.releaseNotesUrl = next.trim() || undefined;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function requireOpenClawRuntime(manifest) {
  const resource = manifest.resources?.find((candidate) => candidate?.id === "openclaw-runtime");
  if (!resource) {
    throw new Error("runtime-manifest.lock.json is missing openclaw-runtime.");
  }
  return resource;
}

function requireConcreteVersion(value, label) {
  const version = typeof value === "string" ? value.trim() : "";
  if (!version || version === "latest") {
    throw new Error(`${label} must pin a concrete version.`);
  }
  return version;
}

function withDefinedEntries(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function buildOpenClawUpdateResource(resource, appVersion, options) {
  const openClawVersion = requireConcreteVersion(resource.version, "openclaw-runtime");
  const releaseNotesUrl =
    options.releaseNotesUrl ?? `https://github.com/${DEFAULT_REPOSITORY}/releases/tag/v${appVersion}`;

  return withDefinedEntries({
    id: resource.id,
    kind: resource.kind,
    label: resource.label,
    summary: resource.summary,
    description: resource.description,
    version: openClawVersion,
    platforms: Array.isArray(resource.platforms) ? resource.platforms : [],
    sourcePolicy: ["download"],
    updatePolicy: resource.updatePolicy ?? "stage-silently-apply-safely",
    installDir: resource.installDir,
    activePath: resource.activePath,
    artifacts: [
      {
        source: "download",
        format: "npm-package",
        package: "openclaw",
        version: openClawVersion
      }
    ],
    dependencies: Array.isArray(resource.dependencies) ? resource.dependencies : [],
    minimumChillClawVersion: appVersion,
    channel: options.channel,
    releaseNotesUrl
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [manifest, packageJson] = await Promise.all([
    readJson(options.manifestPath),
    readJson(options.packageJsonPath)
  ]);
  const appVersion = requireConcreteVersion(packageJson.version, "package.json version");
  const openClawResource = requireOpenClawRuntime(manifest);
  const feed = {
    schemaVersion: manifest.schemaVersion ?? 1,
    generatedAt: new Date().toISOString(),
    resources: [buildOpenClawUpdateResource(openClawResource, appVersion, options)]
  };

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(feed, null, 2)}\n`);
  writeScriptLogLine({
    label: SCRIPT_LABEL,
    scope: "build-runtime-update-feed.main",
    message: `Wrote ${options.outputPath}`
  });
}

await main();
