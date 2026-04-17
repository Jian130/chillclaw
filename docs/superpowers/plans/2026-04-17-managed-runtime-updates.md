# Managed Runtime Updates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let ChillClaw apply approved OpenClaw runtime updates from the app while keeping the packaged runtime lock as the rollback baseline.

**Architecture:** Runtime Manager keeps the packaged manifest as the baseline and consumes an optional curated update feed. OpenClaw runtime updates add an `npm-package` artifact format that installs a concrete `openclaw@version` into ChillClaw's managed runtime directory using managed Node/npm. `OpenClawRuntimeLifecycleService` continues to drive stage/apply/gateway restart through Runtime Manager.

**Tech Stack:** TypeScript, Node.js built-in test runner, Runtime Manager, managed Node/npm, OpenClawAdapter

---

## Chunk 1: OpenClaw Npm-Package Runtime Artifact

### Task 1: Add failing Runtime Manager tests

**Files:**
- Modify: `apps/daemon/src/runtime-manager/runtime-manager.test.ts`
- Modify: `apps/daemon/src/runtime-manager/types.ts`

- [ ] Write a failing test that proves `stageUpdate("openclaw-runtime")` treats a `download`/`npm-package` artifact with package `openclaw` and concrete version as a stageable approved update.
- [ ] Run `node --import tsx --test apps/daemon/src/runtime-manager/runtime-manager.test.ts --test-name-pattern "npm-package"` and verify it fails because `npm-package` is not a supported artifact format/source yet.
- [ ] Add `npm-package` to the artifact type and teach Runtime Manager that npm-package artifacts are usable without a local path.
- [ ] Re-run the targeted Runtime Manager test and verify it passes.

### Task 2: Add failing default OpenClaw provider tests

**Files:**
- Modify: `apps/daemon/src/runtime-manager/default-runtime-manager.test.ts`
- Modify: `apps/daemon/src/runtime-manager/default-runtime-manager.ts`

- [ ] Write a failing test that creates an update feed with an OpenClaw `npm-package` artifact, a fake managed npm command, and verifies apply installs `openclaw@<concrete-version>` into the managed runtime path.
- [ ] Run `node --import tsx --test apps/daemon/src/runtime-manager/default-runtime-manager.test.ts --test-name-pattern "npm-package"` and verify it fails.
- [ ] Implement OpenClaw provider support for `npm-package` by running managed npm with `install --prefix <managed-openclaw-dir> openclaw@<version>` inside a temporary directory, then atomically swapping it into the managed runtime path.
- [ ] Verify the staged/apply flow keeps all installation inside `CHILLCLAW_DATA_DIR`.

## Chunk 2: Update Feed Compatibility

### Task 3: Add manifest metadata for compatibility gates

**Files:**
- Modify: `apps/daemon/src/runtime-manager/types.ts`
- Modify: `apps/daemon/src/runtime-manager/runtime-manager.ts`
- Modify: `apps/daemon/src/runtime-manager/runtime-manager.test.ts`

- [ ] Add optional runtime resource manifest fields for `minimumChillClawVersion`, `maximumChillClawVersion`, `channel`, `releaseNotesUrl`, and `requiresAppUpdate`.
- [ ] Write a test that unsupported compatibility-gated updates are not reported as update available.
- [ ] Implement a small compatibility predicate in Runtime Manager and filter update feed resources through it.
- [ ] Re-run targeted Runtime Manager tests.

## Chunk 3: Verification

### Task 4: Verify the vertical slice

**Files:**
- Modify as needed above.

- [ ] Run `node --import tsx --test apps/daemon/src/runtime-manager/runtime-manager.test.ts`.
- [ ] Run `node --import tsx --test apps/daemon/src/runtime-manager/default-runtime-manager.test.ts`.
- [ ] Run `node --import tsx --test apps/daemon/src/engine/openclaw-runtime-lifecycle-service.test.ts`.
- [ ] Run `npm run build`.
- [ ] Run `npm test` if the targeted tests and build are green.

