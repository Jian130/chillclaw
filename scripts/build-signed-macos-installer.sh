#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

APP_PATH="dist/.macos-staging/ChillClaw.app"
DAEMON_ENTITLEMENTS="scripts/macos-daemon-entitlements.plist"
INSTALLER_PATH="dist/macos/ChillClaw-macOS.dmg"
CHECKSUM_PATH="dist/macos/ChillClaw-macOS.dmg.sha256.txt"

SKIP_BUILD=0
SKIP_RUNTIME_ARTIFACTS=0
SKIP_NOTARIZE=0

usage() {
  cat <<'EOF'
Build, sign, notarize, staple, and assess the ChillClaw macOS DMG for testing on another Mac.

Required environment:
  APP_IDENTITY              Developer ID Application identity name or SHA
  APPLE_NOTARY_KEY_PATH     Path to the App Store Connect API key .p8 file
  APPLE_NOTARY_KEY_ID       App Store Connect API key id
  APPLE_NOTARY_ISSUER_ID    App Store Connect issuer id
  APPLE_TEAM_ID             Apple Developer Team ID

Usage:
  npm run build:mac-signed-installer
  npm run build:mac-signed-installer -- --skip-build
  npm run build:mac-signed-installer -- --skip-runtime-artifacts
  npm run build:mac-signed-installer -- --skip-notarize

Notes:
  --skip-build skips workspace rebuilds during app staging.
  --skip-runtime-artifacts reuses the current runtime-artifacts directory.
  --skip-notarize creates a signed but non-notarized DMG for local-only checks.
EOF
}

log() {
  printf '[ChillClaw signed macOS installer] %s\n' "$*"
}

fail() {
  printf '[ChillClaw signed macOS installer] error: %s\n' "$*" >&2
  exit 1
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "Set $name before running this script."
  fi
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    fail "Required command not found: $name"
  fi
}

notary_key_path() {
  case "$APPLE_NOTARY_KEY_PATH" in
    "~/"*) printf '%s/%s\n' "$HOME" "${APPLE_NOTARY_KEY_PATH#"~/"}" ;;
    *) printf '%s\n' "$APPLE_NOTARY_KEY_PATH" ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-runtime-artifacts)
      SKIP_RUNTIME_ARTIFACTS=1
      ;;
    --skip-notarize)
      SKIP_NOTARIZE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
  shift
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "This script must run on macOS."
fi

require_env APP_IDENTITY
require_env APPLE_NOTARY_KEY_PATH
require_env APPLE_NOTARY_KEY_ID
require_env APPLE_NOTARY_ISSUER_ID
require_env APPLE_TEAM_ID

require_command codesign
require_command file
require_command find
require_command npm
require_command security
require_command shasum
require_command spctl
require_command xcrun

NOTARY_KEY_PATH="$(notary_key_path)"
if [[ ! -f "$NOTARY_KEY_PATH" ]]; then
  fail "APPLE_NOTARY_KEY_PATH does not point to a readable file: $NOTARY_KEY_PATH"
fi

if ! security find-identity -v -p codesigning | grep -F -- "$APP_IDENTITY" >/dev/null; then
  fail "APP_IDENTITY was not found in the current keychain: $APP_IDENTITY"
fi

if [[ "$SKIP_RUNTIME_ARTIFACTS" == "0" ]]; then
  log "Preparing bundled CLI runtime artifacts"
  npm run prepare:runtime-artifacts
else
  log "Reusing existing runtime-artifacts directory"
fi

log "Staging ChillClaw.app"
if [[ "$SKIP_BUILD" == "1" ]]; then
  CHILLCLAW_REQUIRE_CLI_RUNTIME_ARTIFACTS=1 npm run build:mac-installer -- --skip-build --stage-only
else
  CHILLCLAW_REQUIRE_CLI_RUNTIME_ARTIFACTS=1 npm run build:mac-installer -- --stage-only
fi

log "Signing packaged runtime executables"
while IFS= read -r -d '' RUNTIME_EXECUTABLE; do
  if file "$RUNTIME_EXECUTABLE" | grep -q 'Mach-O'; then
    codesign --force --sign "$APP_IDENTITY" --options runtime --timestamp "$RUNTIME_EXECUTABLE"
  fi
done < <(find "$APP_PATH/Contents/Resources/app/runtime-artifacts" -type f -perm -111 -print0)

log "Signing daemon, native executable, and app bundle"
codesign --force --sign "$APP_IDENTITY" --options runtime --timestamp --entitlements "$DAEMON_ENTITLEMENTS" "$APP_PATH/Contents/Resources/runtime/chillclaw-daemon"
codesign --force --sign "$APP_IDENTITY" --options runtime --timestamp "$APP_PATH/Contents/MacOS/ChillClaw"
codesign --force --sign "$APP_IDENTITY" --options runtime --timestamp "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

log "Building signed DMG from signed app"
rm -f "$INSTALLER_PATH" "$CHECKSUM_PATH"
npm run build:mac-installer -- --skip-build --dmg-only
codesign --force --sign "$APP_IDENTITY" --timestamp "$INSTALLER_PATH"
codesign --verify --verbose=2 "$INSTALLER_PATH"

if [[ "$SKIP_NOTARIZE" == "0" ]]; then
  log "Submitting DMG to Apple notary service"
  xcrun notarytool submit "$INSTALLER_PATH" \
    --key "$NOTARY_KEY_PATH" \
    --key-id "$APPLE_NOTARY_KEY_ID" \
    --issuer "$APPLE_NOTARY_ISSUER_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

  log "Stapling notary ticket and assessing Gatekeeper"
  xcrun stapler staple "$INSTALLER_PATH"
  spctl --assess --type open --context context:primary-signature --verbose=2 "$INSTALLER_PATH"
else
  log "Skipping notarization; this DMG is signed but not suitable for Gatekeeper testing on another Mac."
fi

log "Writing checksum"
shasum -a 256 "$INSTALLER_PATH" > "$CHECKSUM_PATH"
test -s "$INSTALLER_PATH"
test -s "$CHECKSUM_PATH"

log "Built $INSTALLER_PATH"
log "Checksum written to $CHECKSUM_PATH"
