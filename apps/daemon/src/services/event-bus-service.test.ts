import test from "node:test";
import assert from "node:assert/strict";

import { EventBusService } from "./event-bus-service.js";

test("event bus delivers typed events to multiple subscribers", async () => {
  const bus = new EventBusService();
  const first: string[] = [];
  const second: string[] = [];

  const unsubscribeFirst = bus.subscribe((event) => {
    first.push(event.type);
  });

  bus.subscribe((event) => {
    second.push(event.type);
  });

  bus.publish({
    type: "deploy.progress",
    correlationId: "corr-1",
    targetId: "managed-local",
    phase: "installing",
    percent: 50,
    message: "Installing OpenClaw."
  });

  unsubscribeFirst();

  bus.publish({
    type: "gateway.status",
    reachable: true,
    pendingGatewayApply: false,
    summary: "Gateway is healthy."
  });

  assert.deepEqual(first, ["deploy.progress"]);
  assert.deepEqual(second, ["deploy.progress", "gateway.status"]);
  assert.equal(bus.listenerCount(), 1);
});

test("event bus writes compact communication logs for subscribe, publish, and unsubscribe", () => {
  const entries: Array<{ message: string; details?: unknown; scope?: string }> = [];
  const bus = new EventBusService((message, details, metadata) => {
    entries.push({ message, details, scope: metadata?.scope });
  });

  const unsubscribe = bus.subscribe(() => undefined);
  bus.publish({
    type: "operation.updated",
    operation: {
      epoch: "operations-test",
      revision: 7,
      data: {
        operationId: "onboarding:model",
        scope: "onboarding",
        action: "onboarding-model-save",
        status: "running",
        phase: "saving-model",
        message: "Saving model credentials with token sk-secret.",
        startedAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:01.000Z"
      }
    }
  });
  unsubscribe();

  assert.deepEqual(entries.map((entry) => entry.scope), [
    "communication.eventBus.subscribe",
    "communication.eventBus.publish",
    "communication.eventBus.unsubscribe"
  ]);
  assert.deepEqual(entries[1]?.details, {
    eventType: "operation.updated",
    listenerCount: 1,
    retained: true,
    operationId: "onboarding:model",
    operationScope: "onboarding",
    operationAction: "onboarding-model-save",
    operationStatus: "running",
    operationPhase: "saving-model",
    revision: 7
  });
  assert.doesNotMatch(JSON.stringify(entries), /sk-secret/);
});

test("event bus retains the latest downloads snapshot for late subscribers", () => {
  const bus = new EventBusService();

  bus.publish({
    type: "downloads.updated",
    snapshot: {
      epoch: "downloads-test",
      revision: 1,
      data: {
        checkedAt: "2026-04-15T00:00:00.000Z",
        jobs: [],
        activeCount: 0,
        queuedCount: 0,
        failedCount: 0,
        summary: "No downloads are running."
      }
    }
  });

  assert.deepEqual(
    bus.getRetainedEvents().map((event) => event.type),
    ["downloads.updated"]
  );
});

test("event bus retains operation snapshots by operation id for late subscribers", () => {
  const bus = new EventBusService();

  bus.publish({
    type: "operation.updated",
    operation: {
      epoch: "operations-test",
      revision: 1,
      data: {
        operationId: "onboarding:install",
        scope: "onboarding",
        action: "onboarding-runtime-install",
        status: "running",
        phase: "installing",
        percent: 55,
        message: "Installing OpenClaw locally.",
        startedAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:01.000Z"
      }
    }
  });

  bus.publish({
    type: "operation.updated",
    operation: {
      epoch: "operations-test",
      revision: 2,
      data: {
        operationId: "runtime:openclaw-runtime:prepare",
        scope: "runtime",
        resourceId: "openclaw-runtime",
        action: "prepare",
        status: "running",
        phase: "verifying-artifact",
        percent: 35,
        message: "Verifying OpenClaw runtime.",
        startedAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:02.000Z"
      }
    }
  });

  bus.publish({
    type: "operation.completed",
    operation: {
      epoch: "operations-test",
      revision: 3,
      data: {
        operationId: "onboarding:install",
        scope: "onboarding",
        action: "onboarding-runtime-install",
        status: "completed",
        phase: "completed",
        percent: 100,
        message: "OpenClaw deployment is complete.",
        startedAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:03.000Z"
      }
    }
  });

  const retained = bus.getRetainedEvents();

  assert.deepEqual(
    retained.map((event) => event.type),
    ["operation.completed", "operation.updated"]
  );
  const install = retained.find((event) => event.type === "operation.completed");
  assert.equal(install?.type, "operation.completed");
  if (install?.type === "operation.completed") {
    assert.equal(install.operation.revision, 3);
    assert.equal(install.operation.data.operationId, "onboarding:install");
  }
});
