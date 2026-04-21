import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { OperationSummary } from "@chillclaw/contracts";

import { OperationStore } from "./operation-store.js";
import { StateStore } from "./state-store.js";

function makeOperation(overrides: Partial<OperationSummary> = {}): OperationSummary {
  return {
    operationId: "onboarding:install",
    scope: "onboarding",
    resourceId: "managed-local",
    action: "onboarding-runtime-install",
    status: "running",
    phase: "installing",
    percent: 55,
    message: "Installing OpenClaw locally.",
    startedAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:01.000Z",
    ...overrides
  };
}

function createStore(name: string) {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/${name}-${randomUUID()}.json`);
  const stateStore = new StateStore(filePath);
  return {
    filePath,
    stateStore,
    operationStore: new OperationStore(stateStore)
  };
}

test("operation store creates, updates, and completes operation summaries", async () => {
  const { operationStore } = createStore("operation-store-lifecycle");

  const created = await operationStore.create(makeOperation());
  const updated = await operationStore.update("onboarding:install", {
    phase: "verifying",
    percent: 84,
    message: "Verifying OpenClaw runtime.",
    updatedAt: "2026-04-21T00:00:02.000Z"
  });
  const completed = await operationStore.complete("onboarding:install", {
    phase: "completed",
    percent: 100,
    message: "OpenClaw deployment is complete.",
    updatedAt: "2026-04-21T00:00:03.000Z"
  });

  assert.equal(created.operationId, "onboarding:install");
  assert.equal(updated?.phase, "verifying");
  assert.equal(updated?.percent, 84);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.percent, 100);
  assert.equal((await operationStore.read("onboarding:install"))?.status, "completed");
});

test("operation store persists operation summaries across store reload", async () => {
  const { filePath, operationStore } = createStore("operation-store-reload");

  await operationStore.create(makeOperation({
    operationId: "runtime:openclaw-runtime:prepare",
    scope: "runtime",
    resourceId: "openclaw-runtime",
    action: "prepare"
  }));

  const reloaded = new OperationStore(new StateStore(filePath));
  const operation = await reloaded.read("runtime:openclaw-runtime:prepare");

  assert.equal(operation?.operationId, "runtime:openclaw-runtime:prepare");
  assert.equal(operation?.scope, "runtime");
  assert.equal(operation?.resourceId, "openclaw-runtime");
});

test("operation store finds active operations by scope resource and action", async () => {
  const { operationStore } = createStore("operation-store-active");

  await operationStore.create(makeOperation());
  await operationStore.create(makeOperation({
    operationId: "runtime:openclaw-runtime:prepare",
    scope: "runtime",
    resourceId: "openclaw-runtime",
    action: "prepare"
  }));

  const active = await operationStore.findActive({
    scope: "runtime",
    resourceId: "openclaw-runtime",
    action: "prepare"
  });

  assert.equal(active?.operationId, "runtime:openclaw-runtime:prepare");
});

test("operation store sanitizes failed operation errors", async () => {
  const { operationStore } = createStore("operation-store-failure");
  const error = Object.assign(new Error("secret token abc123 should not leak"), {
    code: "OPENCLAW_STATUS_TIMEOUT"
  });

  await operationStore.create(makeOperation());
  const failed = await operationStore.fail("onboarding:install", error, {
    phase: "installing",
    message: "OpenClaw status did not respond in time.",
    retryable: true,
    updatedAt: "2026-04-21T00:00:04.000Z"
  });

  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error?.code, "OPENCLAW_STATUS_TIMEOUT");
  assert.equal(failed?.error?.message, "OpenClaw status did not respond in time.");
  assert.equal(failed?.error?.retryable, true);
});
