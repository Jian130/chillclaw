#!/usr/bin/env node

import { spawn } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ROOT = process.cwd();
const SOURCE_LOGO = resolve(ROOT, "apps/website/src/assets/logos/chillclaw-logo-simple-1-640.webp");
const TEMP_DIR = resolve(ROOT, "dist/.brand-icons");
const TEMP_SOURCE_PNG = resolve(TEMP_DIR, "source.png");
const TEMP_ICONSET = resolve(TEMP_DIR, "ChillClawAppIcon.iconset");
const TEMP_FAVICON_PNG = resolve(TEMP_DIR, "favicon-256.png");
const CONTENT_SCALE = 0.88;

const DESKTOP_BRAND_LOGO = resolve(ROOT, "apps/desktop-ui/src/shared/assets/brand/chillclaw-logo-simple-1-640.webp");
const DESKTOP_PUBLIC_DIR = resolve(ROOT, "apps/desktop-ui/public");
const WEBSITE_PUBLIC_DIR = resolve(ROOT, "apps/website/public");
const MAC_NATIVE_RESOURCES_DIR = resolve(ROOT, "apps/macos-native/Sources/ChillClawNative/Resources");
const MAC_NATIVE_BRAND_LOGO = resolve(MAC_NATIVE_RESOURCES_DIR, "ChillClawBrandLogo.png");

const ICONSET_SIZES = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "ignore"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}`));
    });
  });
}

async function ensureOutput(pathname) {
  await mkdir(dirname(pathname), { recursive: true });
}

async function writeSquarePng(size, outputPath) {
  await ensureOutput(outputPath);

  const resizedPath = resolve(TEMP_DIR, `resized-${size}.png`);
  const contentMax = Math.round(size * CONTENT_SCALE);

  await run("sips", ["-Z", String(contentMax), TEMP_SOURCE_PNG, "--out", resizedPath]);
  await run("sips", ["-p", String(size), String(size), resizedPath, "--out", outputPath]);
}

async function writeFaviconSet(publicDir) {
  await mkdir(publicDir, { recursive: true });
  await writeSquarePng(32, resolve(publicDir, "favicon-32x32.png"));
  await writeSquarePng(180, resolve(publicDir, "apple-touch-icon.png"));
  await writeSquarePng(256, TEMP_FAVICON_PNG);
  await run("sips", ["-s", "format", "ico", TEMP_FAVICON_PNG, "--out", resolve(publicDir, "favicon.ico")]);
}

async function writeMacIcon() {
  await mkdir(TEMP_ICONSET, { recursive: true });

  for (const [filename, size] of ICONSET_SIZES) {
    await writeSquarePng(size, resolve(TEMP_ICONSET, filename));
  }

  await mkdir(MAC_NATIVE_RESOURCES_DIR, { recursive: true });
  await run("iconutil", [
    "-c",
    "icns",
    TEMP_ICONSET,
    "-o",
    resolve(MAC_NATIVE_RESOURCES_DIR, "ChillClawAppIcon.icns")
  ]);
  await writeSquarePng(512, resolve(MAC_NATIVE_RESOURCES_DIR, "ChillClawAppIcon.png"));
}

async function main() {
  await rm(TEMP_DIR, { recursive: true, force: true });
  await mkdir(TEMP_DIR, { recursive: true });
  await run("sips", ["-s", "format", "png", SOURCE_LOGO, "--out", TEMP_SOURCE_PNG]);

  await ensureOutput(DESKTOP_BRAND_LOGO);
  await copyFile(SOURCE_LOGO, DESKTOP_BRAND_LOGO);
  await ensureOutput(MAC_NATIVE_BRAND_LOGO);
  await copyFile(TEMP_SOURCE_PNG, MAC_NATIVE_BRAND_LOGO);
  await writeFaviconSet(DESKTOP_PUBLIC_DIR);
  await writeFaviconSet(WEBSITE_PUBLIC_DIR);
  await writeMacIcon();
}

await main();
