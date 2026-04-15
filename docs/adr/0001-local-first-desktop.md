# ADR 0001: Local-first desktop control plane

## Status

Accepted, amended by [ADR 0004: Native macOS client over the local daemon](./0004-native-macos-client.md).

## Context

ChillClaw targets non-technical users who need installation, onboarding, task execution, health visibility, and recovery without using a terminal. The product must later support a mini desktop appliance.

## Decision

ChillClaw will use a local-first architecture:

- a first-party UI initially served as a desktop-ready React application
- a localhost daemon that owns orchestration, policy, health checks, recovery, and diagnostics
- a future desktop shell as packaging and OS integration layer

## Consequences

- The UI can iterate independently of the engine implementation
- The daemon becomes the durable product control plane for future appliance deployments
- The original React-first packaging direction was superseded by ADR 0004. The packaged macOS app now uses a native SwiftUI client over the same daemon, while the React UI remains the local web fallback and developer surface.
