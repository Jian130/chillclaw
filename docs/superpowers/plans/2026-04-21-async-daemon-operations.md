# Async Daemon Operations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long-running ChillClaw UI commands return quickly while daemon-owned operations, retained snapshots, and `/api/events` drive progress and completion across web and native clients.

**Architecture:** Keep the accepted hybrid transport model: HTTP for commands and authoritative reads, `/api/events` for live updates, and daemon services as the product control plane. Add a shared operation runner/store that wraps long-running daemon work, dedupes repeated commands, persists operation state for reconnect recovery, and publishes generic operation events plus existing domain progress/snapshot events.

**Tech Stack:** TypeScript, Node HTTP/WebSocket daemon, `@chillclaw/contracts`, React client event subscriber, Swift `ChillClawKit`, SwiftUI native onboarding and settings screens, existing `EventBusService`, `EventPublisher`, `RuntimeManager`, `DownloadManager`, `OnboardingService`, `SetupService`, and `OpenClawAdapter`.

---

## File Structure

### New files

- Create: `apps/daemon/src/services/operation-store.ts`
- Create: `apps/daemon/src/services/operation-runner.ts`
- Create: `apps/daemon/src/services/operation-store.test.ts`
- Create: `apps/daemon/src/services/operation-runner.test.ts`
- Create: `apps/desktop-ui/src/shared/api/operations.ts`
- Create: `apps/shared/ChillClawKit/Sources/ChillClawClient/OperationModels.swift` if the shared Swift protocol package cannot already mirror the new contracts cleanly

### Existing files to modify

- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/index.test.ts`
- Modify: `apps/daemon/src/services/event-publisher.ts`
- Modify: `apps/daemon/src/services/event-bus-service.ts`
- Modify: `apps/daemon/src/routes/server-context.ts`
- Modify: `apps/daemon/src/routes/onboarding.ts`
- Modify: `apps/daemon/src/routes/runtime.ts`
- Modify: `apps/daemon/src/routes/models.ts`
- Modify: `apps/daemon/src/routes/system.ts`
- Modify: `apps/daemon/src/services/onboarding-service.ts`
- Modify: `apps/daemon/src/services/setup-service.ts`
- Modify: `apps/daemon/src/runtime-manager/runtime-manager.ts`
- Modify: `apps/daemon/src/services/local-model-runtime-service.ts`
- Modify: `apps/daemon/src/services/overview-service.ts`
- Modify: `apps/daemon/src/engine/openclaw-adapter.ts`
- Modify: `apps/daemon/src/platform/cli-runner.ts`
- Modify: `apps/desktop-ui/src/shared/api/client.ts`
- Modify: `apps/desktop-ui/src/shared/api/events.ts`
- Modify: `apps/desktop-ui/src/features/onboarding/OnboardingPage.tsx`
- Modify: `apps/desktop-ui/src/features/deploy/DeployPage.tsx`
- Modify: `apps/desktop-ui/src/features/config/ConfigPage.tsx`
- Modify: `apps/macos-native/Sources/ChillClawNative/OnboardingViewModel.swift`
- Modify: `apps/macos-native/Sources/ChillClawNative/Screens.swift`
- Modify: `apps/shared/ChillClawKit/Sources/ChillClawClient/APIClient.swift`
- Modify: corresponding tests under `apps/daemon/src/**`, `apps/desktop-ui/src/**`, `apps/macos-native/Tests/**`, and `apps/shared/ChillClawKit/Tests/**`

## Chunk 1: Shared Operation Contract

### Task 1: Add generic operation contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/index.test.ts`

- [ ] Add failing contract tests for a serialized operation summary with `operationId`, `scope`, `action`, `status`, `phase`, `percent`, `message`, `startedAt`, `updatedAt`, optional `resourceId`, optional `result`, optional sanitized error, and `retryable`.
- [ ] Add failing contract tests for `operation.updated` and `operation.completed` events carrying `RevisionedSnapshot<OperationSummary>`.
- [ ] Run `npm test --workspace @chillclaw/contracts -- src/index.test.ts` and verify the tests fail because the new contract types do not exist.
- [ ] Implement `OperationScope`, `OperationSummary`, `OperationCommandResponse`, and operation event variants in `packages/contracts/src/index.ts`.
- [ ] Keep `LongRunningOperationSummary` compatible or aliasable while onboarding and existing action responses migrate.
- [ ] Re-run `npm test --workspace @chillclaw/contracts -- src/index.test.ts` and verify it passes.

### Task 2: Extend event publishing for retained operation events

**Files:**
- Modify: `apps/daemon/src/services/event-publisher.ts`
- Modify: `apps/daemon/src/services/event-bus-service.ts`
- Modify: `apps/daemon/src/services/event-publisher.test.ts`
- Modify: `apps/daemon/src/services/event-bus-service.test.ts`
- Modify: `apps/desktop-ui/src/shared/api/events.ts`
- Modify: `apps/desktop-ui/src/shared/api/events.test.ts`

- [ ] Add daemon tests proving `operation.updated` is retained by operation id and delivered to late subscribers.
- [ ] Add web event-client tests proving operation event revisions are tracked like resource snapshots.
- [ ] Run the targeted daemon and web event tests and verify they fail.
- [ ] Implement `publishOperationUpdated` and `publishOperationCompleted` in `EventPublisher`.
- [ ] Retain operation events in `EventBusService` using a key such as `operation:<operationId>`.
- [ ] Track operation revisions in the web event client without disrupting existing resource revision handling.
- [ ] Re-run the targeted tests and verify they pass.

## Chunk 2: Operation Runner Foundation

### Task 3: Add durable operation store

**Files:**
- Create: `apps/daemon/src/services/operation-store.ts`
- Create: `apps/daemon/src/services/operation-store.test.ts`
- Modify: `apps/daemon/src/services/state-store.ts` if operation state belongs in the existing product state file

- [ ] Write tests for creating, updating, completing, failing, and reading operations by id and by scope/resource/action key.
- [ ] Write a test proving operation summaries survive store reload.
- [ ] Run `node --import tsx --test apps/daemon/src/services/operation-store.test.ts` and verify it fails.
- [ ] Implement the minimal persisted store.
- [ ] Sanitize stored errors to code/message/retryability only.
- [ ] Re-run the operation store test and verify it passes.

### Task 4: Add operation runner with in-flight dedupe

**Files:**
- Create: `apps/daemon/src/services/operation-runner.ts`
- Create: `apps/daemon/src/services/operation-runner.test.ts`
- Modify: `apps/daemon/src/routes/server-context.ts`

- [ ] Write a test proving a second command for the same in-flight operation returns the existing operation instead of starting another worker.
- [ ] Write a test proving progress updates are persisted and published.
- [ ] Write a test proving worker failure marks the operation failed and publishes a terminal event.
- [ ] Run `node --import tsx --test apps/daemon/src/services/operation-runner.test.ts` and verify it fails.
- [ ] Implement `OperationRunner.startOrResume({ scope, resourceId, action, key }, worker)`.
- [ ] Wire one shared runner into route context.
- [ ] Re-run the operation runner test and verify it passes.

## Chunk 3: Fix First-Run Onboarding Timeout Class

### Task 5: Bound OpenClaw overview probes

**Files:**
- Modify: `apps/daemon/src/platform/cli-runner.ts`
- Modify: `apps/daemon/src/engine/openclaw-adapter.ts`
- Modify: `apps/daemon/src/services/overview-service.ts`
- Modify: `apps/daemon/src/engine/openclaw-adapter.test.ts`
- Modify: `apps/daemon/src/services/overview-service.test.ts`

- [ ] Add a failing test where `openclaw status --json` or `openclaw gateway status --json` never resolves and `/api/overview` still returns a degraded/checking state.
- [ ] Add a failing test proving the degraded response includes clear user-facing recovery/checking copy and logs the timeout.
- [ ] Run targeted daemon tests and verify they fail.
- [ ] Add explicit timeout support to the relevant OpenClaw status/gateway probe calls.
- [ ] Ensure overview returns last-known daemon state quickly when probes time out.
- [ ] Re-run targeted tests and verify they pass.

### Task 6: Convert onboarding runtime install/update to operation-backed commands

**Files:**
- Modify: `apps/daemon/src/routes/onboarding.ts`
- Modify: `apps/daemon/src/services/onboarding-service.ts`
- Modify: `apps/daemon/src/services/setup-service.ts`
- Modify: `apps/daemon/src/services/onboarding-service.test.ts`
- Modify: `apps/desktop-ui/src/shared/api/client.ts`
- Modify: `apps/desktop-ui/src/features/onboarding/OnboardingPage.tsx`
- Modify: `apps/desktop-ui/src/features/onboarding/OnboardingPage.test.ts`
- Modify: `apps/macos-native/Sources/ChillClawNative/OnboardingViewModel.swift`
- Modify: `apps/macos-native/Tests/ChillClawNativeTests/OnboardingTests.swift`
- Modify: `apps/shared/ChillClawKit/Sources/ChillClawClient/APIClient.swift`

- [ ] Add daemon tests proving `POST /api/onboarding/runtime/install` returns before the fake install worker resolves.
- [ ] Add daemon tests proving install progress and completion update operation state and onboarding draft state.
- [ ] Add web tests proving install UI can advance from event/resync state without waiting for a long response.
- [ ] Add native tests proving the Swift view model treats the command response as accepted/running and advances from event/resync state.
- [ ] Run targeted onboarding tests and verify they fail.
- [ ] Move install/update work into `OperationRunner`.
- [ ] Return an operation-backed command response immediately.
- [ ] Preserve current onboarding `operations.install` during migration by mapping the shared operation into onboarding state.
- [ ] Update React and native clients to render returned operation state and rely on `/api/events` plus `GET /api/onboarding/state` for completion.
- [ ] Re-run targeted daemon, web, native, and Swift client tests.

## Chunk 4: Runtime Manager And Local AI Operations

### Task 7: Convert Runtime Manager action routes

**Files:**
- Modify: `apps/daemon/src/routes/runtime.ts`
- Modify: `apps/daemon/src/runtime-manager/runtime-manager.ts`
- Modify: `apps/daemon/src/runtime-manager/runtime-manager.test.ts`
- Modify: `apps/desktop-ui/src/features/deploy/DeployPage.tsx`
- Modify: `apps/desktop-ui/src/features/deploy/DeployPage.test.tsx`
- Modify: `apps/macos-native/Sources/ChillClawNative/Screens.swift`
- Modify: native deployment/settings tests as needed

- [ ] Add route tests proving prepare/repair/stage/apply/rollback return operation state quickly.
- [ ] Add tests proving existing `runtime.progress` and `runtime.completed` events still publish.
- [ ] Add client tests proving runtime UI updates from events and quick resync reads.
- [ ] Run targeted tests and verify they fail.
- [ ] Wrap Runtime Manager action calls in `OperationRunner`.
- [ ] Publish generic operation events alongside existing runtime events.
- [ ] Re-run targeted tests.

### Task 8: Convert local model runtime install/repair

**Files:**
- Modify: `apps/daemon/src/routes/models.ts`
- Modify: `apps/daemon/src/services/local-model-runtime-service.ts`
- Modify: `apps/daemon/src/services/local-model-runtime-service.test.ts`
- Modify: `apps/desktop-ui/src/features/onboarding/OnboardingPage.tsx`
- Modify: `apps/macos-native/Sources/ChillClawNative/OnboardingViewModel.swift`

- [ ] Add tests proving local-runtime install/repair returns an operation response before Ollama/model pull work completes.
- [ ] Preserve existing local-runtime progress/completion and download events.
- [ ] Ensure operation state references the active Download Manager job when a model pull is running.
- [ ] Update web/native onboarding local-runtime handling to use operation state plus existing local-runtime events.
- [ ] Re-run targeted daemon, web, and native tests.

## Chunk 5: Setup, Recovery, Diagnostics, And Service Work

### Task 9: Convert setup and recovery commands that can block

**Files:**
- Modify: `apps/daemon/src/routes/onboarding.ts`
- Modify: `apps/daemon/src/routes/channels.ts`
- Modify: `apps/daemon/src/routes/system.ts`
- Modify: `apps/daemon/src/services/channel-setup-service.ts`
- Modify: `apps/daemon/src/services/onboarding-service.ts`
- Modify: related daemon tests

- [ ] Migrate onboarding model/channel/complete commands only when they start provider auth, channel pairing, gateway apply, warmup, or other long-running work.
- [ ] Migrate channel setup session input when it can wait on OpenClaw or external pairing state.
- [ ] Migrate gateway restart and recovery actions to operation-backed commands.
- [ ] Migrate diagnostics export to an operation that returns the produced bundle path/reference on completion.
- [ ] Keep fast local-only mutations synchronous and snapshot-publishing.
- [ ] Add tests for each migrated route family.

### Task 10: Convert app update and packaged service work

**Files:**
- Modify: `apps/daemon/src/routes/system.ts`
- Modify: `apps/daemon/src/services/app-update-service.ts`
- Modify: `apps/daemon/src/services/app-service-manager.ts`
- Modify: web/native settings or operations screens as needed

- [ ] Make app update check operation-backed when it reaches the network.
- [ ] Make service install/restart/uninstall operation-backed.
- [ ] Make app uninstall operation-backed if it performs multi-step packaged cleanup.
- [ ] Add tests proving command responses return quickly and events drive UI updates.

## Chunk 6: Verification And Rollout

### Task 11: Cross-client recovery verification

**Files:**
- Modify tests across `apps/desktop-ui/src/shared/api/events.test.ts`
- Modify tests across `apps/macos-native/Tests/ChillClawNativeTests`
- Modify tests across `apps/shared/ChillClawKit/Tests`

- [ ] Add web tests for event reconnect followed by operation/state resync.
- [ ] Add native tests for app sleep or URL timeout followed by operation/state resync.
- [ ] Add tests proving missed operation completion is visible from a later GET.
- [ ] Add tests proving duplicate button clicks do not start duplicate installs.

### Task 12: Full verification

**Files:**
- Modify as needed above.

- [ ] Run `npm test --workspace @chillclaw/contracts`.
- [ ] Run `npm test --workspace @chillclaw/daemon`.
- [ ] Run `npm test --workspace @chillclaw/desktop-ui` or the repo's desktop UI test command.
- [ ] Run `swift test --package-path apps/shared/ChillClawKit`.
- [ ] Run `swift test --package-path apps/macos-native`.
- [ ] Run `npm run build`.
- [ ] Run `npm test`.
- [ ] Smoke clean first-run onboarding on macOS and verify Step 2 keeps showing progress after the install HTTP command has returned.

## Notes

- Start with onboarding runtime install because it directly addresses the observed timeout around Step 2.
- Keep domain events during migration; do not force every UI to understand only generic operations in one pass.
- Do not broaden the engine adapter contract to solve UI transport problems.
- Do not move commands onto WebSocket RPC.
- Do not let `fresh=1` become an unbounded OpenClaw probe.
