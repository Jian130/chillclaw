# ADR 0005: Hybrid HTTP and WebSocket daemon transport

## Status

Accepted

## Context

ChillClaw now has multiple first-party clients:

- `apps/desktop-ui` as the browser-based and fallback React client
- `apps/macos-native` as the packaged SwiftUI macOS client
- `apps/shared/ChillClawKit` as the shared Swift protocol/client layer for native clients

Those clients all talk to the same daemon-backed product surface in `apps/daemon`.

The daemon already had a strong request/response API for install, onboarding, configuration, AI employee management, diagnostics, and health. It also already maintained an internal live bridge to the OpenClaw gateway for chat and runtime behavior.

The missing piece was a single client-facing push channel that could deliver fast live updates without turning the whole product API into a custom socket RPC layer.

## Decision

ChillClaw will use a hybrid transport model:

- UI clients use HTTP for commands, authoritative reads, and fresh reloads.
- UI clients use one daemon WebSocket endpoint at `/api/events` for live push updates.
- Only the daemon talks to the OpenClaw gateway WebSocket directly.
- The daemon remains the single product control plane between UI clients and the engine/runtime.
- Long-running commands return quickly with daemon-owned operation state, then publish progress and completion through `/api/events`.

This preserves the existing boundary:

`UI -> local daemon -> EngineAdapter -> engine`

It also aligns with the current five-manager engine seam:

- `instances`
- `config`
- `aiEmployees`
- `gateway`
- `plugins`

## Adapter implications

The daemon-side infrastructure seams should be explicit:

- `apps/daemon/src/platform/cli-runner.ts`
- `apps/daemon/src/platform/openclaw-gateway-socket-adapter.ts`
- `apps/daemon/src/platform/filesystem-state-adapter.ts`
- `apps/daemon/src/platform/secrets-adapter.ts`

These adapters stay daemon-internal. UI clients do not use them directly.

## Consequences

### Positive

- React, SwiftUI, and future Windows clients can share one daemon API model.
- HTTP remains simple and cache-friendly for deterministic reads and writes.
- WebSocket provides low-latency progress, gateway status, chat, and recovery updates.
- The OpenClaw gateway socket remains internal to the daemon, so native and web clients stay OpenClaw-agnostic.

### Negative

- ChillClaw must maintain both HTTP and WebSocket client libraries.
- Some product flows now have two surfaces:
  - authoritative HTTP reads
  - push-oriented event updates
- Long-running product flows need durable operation state so clients can recover after sleep, reconnect, route changes, or timed-out HTTP calls.

## Async operation extension

The hybrid model should be applied consistently across the product. HTTP commands remain the command surface, but any work that may exceed 1-2 seconds should be accepted as a daemon operation instead of being completed inside the request lifetime.

The canonical flow is:

1. Client sends an HTTP command.
2. Daemon validates input, creates or resumes an operation, persists the operation summary, and returns quickly.
3. Daemon continues work in the background.
4. Daemon publishes progress, completion, and affected resource snapshots through `/api/events`.
5. Clients render live updates from events and recover missed updates through HTTP reads.

This extension applies first to onboarding runtime install/checking, runtime manager actions, local model setup, gateway restart, recovery, diagnostics export, app update checks, and any OpenClaw CLI or gateway probe that can stall.

The detailed project reference is `docs/reference/async-daemon-operations.md`.

## Rules

- Do not move product mutations to WebSocket RPC by default.
- Do not let frontend clients connect to OpenClaw directly.
- Keep HTTP as the source of truth for refresh and reconcile behavior.
- Use the daemon WebSocket for push updates, not for replacing the whole API surface.
- Do not let UI requests wait on unbounded OpenClaw CLI, gateway, download, install, update, recovery, or health-check work.
- Keep events as live notifications; persist operation state and resource snapshots for reconnect and recovery.
