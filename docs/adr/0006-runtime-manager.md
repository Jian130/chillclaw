# ADR 0006: Daemon-owned Runtime Manager

## Status

Accepted

## Context

ChillClaw needs ordinary users to reach a useful local-first setup quickly without installing developer prerequisites by hand.

The managed setup path now depends on several prerequisite resources:

- Node/npm for managed OpenClaw installs and npm-backed recovery paths
- managed OpenClaw itself
- Ollama for local AI runtime support
- local model catalog metadata
- future local runtime resources such as model-specific artifacts or additional local LLM backends

Historically these prerequisites were handled inside feature-specific install paths. That made first-run setup harder to reason about, made packaging behavior diverge from daemon behavior, and encouraged each feature to invent its own download, verification, and repair flow.

Runtime updates also need a stronger rule than "ask upstream for latest". ChillClaw should install and update only versions selected by ChillClaw release metadata so first-run and recovery behavior stays pinned, tested, and rollbackable.

## Decision

ChillClaw will use a daemon-owned `RuntimeManager` as the canonical lifecycle owner for generic prerequisites.

The Runtime Manager owns:

- manifest-driven resource definitions
- bundled artifact discovery
- approved download fallback selection
- digest verification
- provider verification hooks
- dependency ordering
- state persistence for active and staged versions
- repair, staging, apply, rollback, and remove actions
- background checking/staging from a ChillClaw-curated update feed

The packaged baseline is `runtime-manifest.lock.json`.

Optional update metadata comes from a curated feed configured by `CHILLCLAW_RUNTIME_UPDATE_FEED_URL`. The feed lists only ChillClaw-approved versions, artifact URLs or concrete npm package artifacts, sha256 digests when applicable, platform constraints, dependencies, app compatibility gates, and update policy. Stable macOS releases publish this feed as `runtime-update.json` on GitHub Releases, and packaged apps default to the latest-release download URL.

Stable macOS release packaging prepares runnable CLI artifacts before staging the app: an extracted Node.js distribution directory and a standalone `ollama` binary. Runtime artifact packaging rejects GUI apps and installer images such as `Ollama.app`, `Ollama.dmg`, and `.pkg` payloads.

The Runtime Manager exposes daemon routes under `/api/runtime/resources` and emits runtime events over the existing daemon WebSocket event bus. It also contributes `ProductOverview.runtimeManager` so clients can render staged update state without duplicating backend logic.

The Runtime Manager does not replace the engine adapter seam. It provides the executable/runtime prerequisites. OpenClaw-specific behavior stays behind `OpenClawAdapter`.

## Integration rules

- `node-npm-runtime` prepares the managed Node/npm toolchain and verifies `node --version` plus `npm --version`.
- `openclaw-runtime` is prepared through the Runtime Manager for managed-local installs. `OpenClawAdapter` still owns gateway baseline normalization, provider configuration, gateway restart, and health verification.
- `ollama-runtime` installs or updates the Ollama CLI only. Model weights remain outside the app bundle and outside generic runtime updates.
- `local-model-catalog` is metadata-only. Updating it must not download model weights.
- Existing deploy and local AI APIs remain compatibility wrappers over the same canonical runtime paths where practical.

## Update rules

- Runtime updates are curated by ChillClaw metadata, not discovered from upstream `latest`.
- The daemon may check and stage approved updates in the background.
- Staging must not affect the active install.
- Applying an update snapshots the current active version, verifies the new version, and restores the previous version when verification fails.
- Background apply requires a safe idle point. User-triggered apply uses the explicit runtime action path.
- Ollama updates must preserve the managed models directory.
- System OpenClaw installs are not updated by the Runtime Manager.

## Consequences

### Positive

- First-run setup can prefer packaged artifacts and avoid unnecessary onboarding downloads.
- Runtime install, repair, update, and rollback behavior has one daemon-owned state model.
- Clients can show runtime readiness and staged updates through shared contracts.
- Future local runtime resources have a clear extension point.
- Engine-specific logic remains constrained to adapter/provider verification boundaries.

### Negative

- Release packaging now needs to keep runtime artifacts and manifests aligned.
- Runtime manifests add another release-owned contract that must be tested before publication.
- OpenClaw packaged artifacts still need a release-produced pinned artifact before the npm fallback can become only a recovery path.

## Follow-up rules

- Do not add feature-specific runtime download code when a Runtime Manager provider can own it.
- Do not package GUI apps or installer images as managed runtime artifacts when a CLI payload is sufficient.
- Do not surface raw artifact URLs, digests, or upstream release labels in normal client UI.
- Do not let model catalog updates imply model weight downloads.
- Update this ADR and `docs/reference/runtime-manager.md` when adding new runtime resource kinds or update policies.
