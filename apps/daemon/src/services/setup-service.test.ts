import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { MockAdapter } from "../engine/mock-adapter.js";
import { EventBusService } from "./event-bus-service.js";
import { EventPublisher } from "./event-publisher.js";
import { OverviewService } from "./overview-service.js";
import { SetupService } from "./setup-service.js";
import type { PresetSkillSyncOverview } from "@slackclaw/contracts";
import { StateStore } from "./state-store.js";

function createService(testName: string) {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/${testName}-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);

  return {
    store,
    service: new SetupService(adapter, store, overviewService)
  };
}

test("first-run install no longer marks the whole onboarding flow complete", async () => {
  const { service, store } = createService("setup-service-onboarding");

  const result = await service.runFirstRunSetup();
  const state = await store.read();

  assert.equal(result.status, "completed");
  assert.equal(Boolean(result.install?.engineStatus.installed), true);
  assert.equal(Boolean(state.introCompletedAt), true);
  assert.equal(state.setupCompletedAt, undefined);
  assert.equal(result.overview.firstRun.setupCompleted, false);
});

test("first-run setup publishes deploy progress and completion events", async () => {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/setup-service-events-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const bus = new EventBusService();
  const service = new SetupService(adapter, store, overviewService, new EventPublisher(bus));
  const events: string[] = [];
  const unsubscribe = bus.subscribe((event) => {
    events.push(event.type);
  });

  await service.runFirstRunSetup();
  unsubscribe();

  assert.deepEqual(events, ["deploy.progress", "deploy.completed"]);
});

test("first-run setup fails when preset skill reconcile reports repair needed", async () => {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/setup-service-preset-sync-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  await store.update((current) => ({
    ...current,
    onboarding: {
      draft: {
        currentStep: "employee",
        install: {
          installed: true,
          disposition: "installed-managed"
        },
        employee: {
          presetId: "guided",
          avatarPresetId: "operator",
          name: "Research Helper",
          jobTitle: "Researcher",
          presetSkillIds: ["research-brief"]
        }
      }
    }
  }));

  const service = new SetupService(
    adapter,
    store,
    overviewService,
    undefined,
    {
      setDesiredPresetSkillIds: async () =>
        ({
          targetMode: "managed-local",
          summary: "Repair needed",
          repairRecommended: true,
          entries: [
            {
              presetSkillId: "research-brief",
              runtimeSlug: "research-brief",
              targetMode: "managed-local",
              status: "failed",
              lastError: "Missing bundled asset",
              updatedAt: new Date().toISOString()
            }
          ]
        }) satisfies PresetSkillSyncOverview
    } as never
  );

  const result = await service.runFirstRunSetup();

  assert.equal(result.status, "failed");
  assert.equal(result.steps.some((step) => step.id === "install-preset-skills" && step.status === "failed"), true);
});
