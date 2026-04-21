# Async Daemon Operations

This document defines the target communication pattern for long-running ChillClaw work across React, native macOS, future Windows, and any other first-party client.

## Problem

Several user flows currently start from a UI request that can wait on slow daemon work:

- managed OpenClaw install and verification
- runtime prepare, repair, update, apply, and rollback
- local AI runtime install and model pulls
- model and channel setup that shells out to OpenClaw or waits for an interactive session
- gateway restart, health checks, recovery actions, and diagnostics export
- app update checks and packaged service operations

That is fragile because a UI HTTP request can time out or be canceled while the daemon is still doing useful work. A timeout then looks like failure even when the operation later succeeds.

## Decision

Long-running product work must use daemon-owned asynchronous operations:

1. A UI client sends an HTTP command.
2. The daemon validates the request, creates or resumes an operation, persists enough state to recover, and returns quickly.
3. The daemon performs the work in the background.
4. The daemon publishes progress and final state through `/api/events`.
5. Clients update UI from events and use GET reads to resync after missed events, reconnects, app sleep, or process restart.

This is an extension of the accepted hybrid transport model in `docs/adr/0005-hybrid-http-websocket-core.md`. It does not replace HTTP with WebSocket RPC and does not introduce a second bus.

## Core rules

- HTTP commands should return quickly. Target under 500 ms; never wait on unbounded OpenClaw CLI, gateway, download, install, or external network work.
- If work can exceed 1-2 seconds, model it as an operation.
- Events are live updates, not the source of truth. The daemon persists operation state and resource snapshots so clients can recover by reading HTTP state.
- GET routes return last-known daemon state quickly. They may start or request a bounded background refresh, but they must not block the UI on unbounded engine probes.
- `fresh=1` means "refresh daemon-owned state if possible," not "make the UI wait forever for upstream truth."
- Every operation has an idempotency key or deterministic in-flight key so repeated clicks, reconnects, or native timeout recovery do not start duplicate work.
- Operation progress and final events must include enough identifiers for every client to update only the affected screen.
- Secrets stay in the daemon and OS secure store. Operation events and persisted summaries must not include secret values, raw config, phone numbers, or user data.

## Operation contract

The existing `LongRunningOperationSummary` shape is the starting point:

```ts
interface LongRunningOperationSummary {
  operationId: string;
  action: string;
  status: "pending" | "running" | "completed" | "failed" | "timed-out";
  phase?: string;
  message: string;
  startedAt: string;
  updatedAt: string;
  deadlineAt?: string;
  errorCode?: string;
  retryable?: boolean;
}
```

The target implementation should add a shared operation resource around that summary rather than creating one-off operation fields in each service:

- `operationId`: stable identifier for the user-visible work
- `scope`: domain such as `onboarding`, `runtime`, `local-runtime`, `channel`, `gateway`, `recovery`, `diagnostics`, or `app-update`
- `resourceId`: optional affected resource, such as `openclaw-runtime`, `managed-local`, channel entry id, or download job id
- `status`, `phase`, `percent`, and user-facing `message`
- `result`: minimal typed result reference or affected resource snapshot id
- `error`: sanitized code, retryability, and clear user-facing message
- `sync`: revision metadata for snapshots published by the operation

Operation command responses should return the current operation summary and any immediately available daemon-owned snapshot. They should not wait for the operation to finish.

## Event contract

Use the existing `/api/events` WebSocket endpoint and `EventPublisher`.

Current retained snapshot events remain authoritative resync points:

- `overview.updated`
- `model-config.updated`
- `channel-config.updated`
- `plugin-config.updated`
- `skill-catalog.updated`
- `preset-skill-sync.updated`
- `downloads.updated`
- `ai-team.updated`

Current domain progress events remain useful:

- `deploy.progress` / `deploy.completed`
- `runtime.progress` / `runtime.completed` / `runtime.update-staged`
- `local-runtime.progress` / `local-runtime.completed`
- `download.progress` / `download.completed` / `download.failed`
- `channel.session.updated`
- `task.progress`
- `chat.stream`

The migration should add a generic retained operation event for cross-client consistency:

```ts
type OperationEvent =
  | { type: "operation.updated"; operation: RevisionedSnapshot<OperationSummary> }
  | { type: "operation.completed"; operation: RevisionedSnapshot<OperationSummary> };
```

Domain progress events can stay for specialized UI. The generic operation event is the common shell clients use for busy states, reconnect recovery, and notification surfaces.

## Client contract

Every first-party client should follow the same loop:

1. Load initial screen state through fast GET routes.
2. Subscribe to `/api/events`.
3. On command, optimistically render the returned operation state.
4. On progress events, update local progress for the matching `operationId` or affected resource.
5. On snapshot events, replace local resource state when the event revision is newer.
6. On reconnect, app foreground, or stale event stream, fetch the relevant daemon state and active operations.

Clients should not rely on a long HTTP response for success. Closing a window, app sleep, HTTP timeout, or route navigation should not cancel daemon work unless the user explicitly cancels an operation that supports cancellation.

## Daemon service contract

Long-running services should use one operation runner rather than each route inventing its own background handling:

- dedupe in-flight operations by scope/resource/action/idempotency key
- persist operation lifecycle transitions
- publish `operation.updated` and domain-specific progress events
- publish retained resource snapshots after meaningful state changes
- record sanitized logs for failures
- support cancellation only when the underlying worker can stop safely
- recover terminal or resumable state on daemon startup

Existing scoped operation fields in onboarding can continue during migration, but new app-wide work should use the shared operation store.

## Fast reads and bounded probes

The async operation pattern also changes read behavior.

Routes such as `/api/overview`, `/api/deploy/targets`, `/api/models/config`, `/api/channels/config`, and `/api/capabilities/overview` should return the daemon's last-known view quickly. If the view is stale, the response can say so and the daemon can start a bounded refresh operation in the background.

OpenClaw probes must have explicit timeouts. A stuck `openclaw status --json`, `openclaw gateway status --json`, provider auth command, plugin command, or gateway call should degrade the affected status and publish a repair/checking state rather than blocking the client.

## Migration inventory

Phase 1 should cover the user-visible timeout class:

- `POST /api/onboarding/runtime/install`
- `POST /api/onboarding/runtime/update`
- `POST /api/onboarding/complete`
- `GET /api/overview`
- `GET /api/deploy/targets`
- OpenClaw status and gateway status probes used by overview and onboarding

Phase 2 should cover runtime and local AI lifecycle:

- `POST /api/runtime/resources/:resourceId/prepare`
- `POST /api/runtime/resources/:resourceId/repair`
- `POST /api/runtime/resources/:resourceId/check-update`
- `POST /api/runtime/resources/:resourceId/stage-update`
- `POST /api/runtime/resources/:resourceId/apply-update`
- `POST /api/runtime/resources/:resourceId/rollback`
- `POST /api/models/local-runtime/install`
- `POST /api/models/local-runtime/repair`
- `POST /api/onboarding/model/entries`
- `POST /api/onboarding/channel/entries`
- `PATCH /api/onboarding/channel/entries/:entryId`
- download pause/resume/cancel state updates where they affect active work

The onboarding entry routes use fixed operation IDs so a second click resumes the same accepted work instead of starting a duplicate mutation:

- `onboarding:model` for model save/auth start
- `onboarding:channel` for channel save/login start

Phase 3 should cover setup, recovery, and service management:

- `POST /api/channels/entries`
- `PATCH /api/channels/entries/:entryId`
- `POST /api/channels/session/:sessionId/input`
- `POST /api/deploy/gateway/restart`
- `POST /api/recovery/:actionId`
- `GET /api/diagnostics`
- `POST /api/app/update/check`
- `POST /api/service/install`
- `POST /api/service/restart`
- `POST /api/service/uninstall`
- `POST /api/app/uninstall`

Phase 4 should make remaining command routes explicit:

- keep fast, purely local state mutations synchronous
- keep chat message send as command-plus-stream, but make the command return as soon as the assistant run is accepted
- keep read-only catalog routes synchronous unless they start external work
- mark unsupported legacy routes unchanged until they are removed

## Verification expectations

For each migrated route:

- add a test proving the HTTP response returns before the worker resolves
- add a test proving progress and completion events are published
- add a test proving reconnect/resync reads can recover the operation state
- add a test proving duplicate commands reuse or reject the active operation deterministically
- add a timeout/probe test for any OpenClaw CLI or gateway call involved
- update web and native tests so UI state advances from events and resync, not long request completion

End-to-end verification should include a clean first-run onboarding install on macOS, with the UI showing progress while the original HTTP command has already returned.
