import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { OnboardingStateResponse } from "@slackclaw/contracts";

import { MockAdapter } from "../engine/mock-adapter.js";
import { AITeamService } from "./ai-team-service.js";
import { ChannelSetupService } from "./channel-setup-service.js";
import { OnboardingService } from "./onboarding-service.js";
import { OverviewService } from "./overview-service.js";
import { PresetSkillService } from "./preset-skill-service.js";
import { StateStore } from "./state-store.js";

function createService(testName: string) {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/${testName}-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const channelSetupService = new ChannelSetupService(adapter, store);
  const presetSkillService = new PresetSkillService(adapter, store);
  const aiTeamService = new AITeamService(adapter, store, undefined, presetSkillService);

  return {
    adapter,
    store,
    presetSkillService,
    service: new OnboardingService(adapter, store, overviewService, channelSetupService, aiTeamService, presetSkillService)
  };
}

test("onboarding service persists draft progress and uses full completion as the route gate", async () => {
  const { service, store } = createService("onboarding-service-draft");

  const initial = await service.getState();
  assert.equal(initial.draft.currentStep, "welcome");
  assert.equal(initial.firstRun.setupCompleted, false);

  const updated = await service.updateState({
    currentStep: "model",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    model: {
      providerId: "anthropic",
      modelKey: "anthropic/claude-opus-4-6",
      entryId: "entry-anthropic"
    }
  });

  assert.equal(updated.draft.currentStep, "model");
  assert.equal(updated.draft.install?.version, "2026.3.13");
  assert.equal(updated.draft.model?.entryId, "entry-anthropic");

  const persisted = await store.read();
  assert.equal(persisted.onboarding?.draft.currentStep, "model");
  assert.equal(persisted.setupCompletedAt, undefined);
});

test("saving the employee draft stays lightweight once the channel draft is already staged", async () => {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/onboarding-service-employee-draft-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const channelSetupService = new ChannelSetupService(adapter, store);
  Object.assign(channelSetupService, {
    async getConfigOverview() {
      throw new Error("Employee draft saves should not fetch the channel overview.");
    }
  });
  const aiTeamService = new AITeamService(adapter, store);
  const service = new OnboardingService(adapter, store, overviewService, channelSetupService, aiTeamService);

  await store.update((current) => ({
    ...current,
    onboarding: {
      draft: {
        currentStep: "employee",
        channel: {
          channelId: "wechat",
          entryId: "wechat:default"
        },
        channelProgress: {
          status: "staged",
          message: "WeChat is staged."
        }
      }
    }
  }));

  const result = await service.saveEmployeeDraft({
    name: "Alex Morgan",
    jobTitle: "Research Analyst",
    avatarPresetId: "onboarding-analyst"
  });

  assert.equal(result.draft.employee?.name, "Alex Morgan");
  assert.equal(result.draft.employee?.jobTitle, "Research Analyst");
  assert.equal(result.summary.channel?.entryId, "wechat:default");
});

test("onboarding completion clears the draft, marks setup completed, and returns a destination summary", async () => {
  const { service, store } = createService("onboarding-service-complete");

  await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    permissions: {
      confirmed: true,
      confirmedAt: "2026-03-24T00:01:00.000Z"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "mock-openai-gpt-4o-mini"
    },
    channel: {
      channelId: "telegram",
      entryId: "telegram:default"
    },
    channelProgress: {
      status: "staged",
      requiresGatewayApply: true
    },
    employee: {
      memberId: "member-1",
      name: "Alex Morgan",
      jobTitle: "Research Analyst",
      avatarPresetId: "onboarding-analyst"
    }
  });

  const result = await service.complete({ destination: "chat" });
  const state = await store.read();

  assert.equal(result.status, "completed");
  assert.equal(result.destination, "chat");
  assert.equal(result.overview.firstRun.setupCompleted, true);
  assert.equal(Boolean(state.setupCompletedAt), true);
  assert.equal(state.onboarding, undefined);
  assert.equal(result.summary.channel?.channelId, "telegram");
  assert.equal(result.summary.employee?.name, "Alex Morgan");
});

test("missing onboarding channel sessions clear the stale session id before surfacing an error", async () => {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/onboarding-service-missing-session-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const channelSetupService = new ChannelSetupService(adapter, store);
  Object.assign(channelSetupService, {
    async getSession() {
      throw new Error("Channel session not found.");
    }
  });
  const presetSkillService = new PresetSkillService(adapter, store);
  const aiTeamService = new AITeamService(adapter, store, undefined, presetSkillService);
  const service = new OnboardingService(adapter, store, overviewService, channelSetupService, aiTeamService, presetSkillService);

  await service.updateState({
    currentStep: "channel",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    permissions: {
      confirmed: true,
      confirmedAt: "2026-03-24T00:01:00.000Z"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "mock-openai-gpt-4o-mini"
    },
    channel: {
      channelId: "wechat",
      entryId: "wechat:default"
    },
    channelProgress: {
      status: "capturing",
      sessionId: "wechat:default:login",
      message: "Started WeChat login",
      requiresGatewayApply: false
    },
    activeChannelSessionId: "wechat:default:login"
  });

  await assert.rejects(() => service.getChannelSession("wechat:default:login"), /start the login again/i);

  const persisted = await store.read();
  assert.equal(persisted.onboarding?.draft.activeChannelSessionId, undefined);
  assert.equal(persisted.onboarding?.draft.channel?.channelId, "wechat");
  assert.equal(persisted.onboarding?.draft.channelProgress?.status, "idle");
});

test("onboarding completion runs the dedicated runtime finalization step before marking setup complete", async () => {
  class FinalizingAdapter extends MockAdapter {
    gatewayFinalizeCalls = 0;

    override async finalizeOnboardingSetup() {
      this.gatewayFinalizeCalls += 1;
      return super.finalizeOnboardingSetup();
    }
  }

  const filePath = resolve(process.cwd(), `apps/daemon/.data/onboarding-service-pending-gateway-${randomUUID()}.json`);
  const adapter = new FinalizingAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const channelSetupService = new ChannelSetupService(adapter, store);
  const aiTeamService = new AITeamService(adapter, store);
  const service = new OnboardingService(adapter, store, overviewService, channelSetupService, aiTeamService);

  await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "installed-managed"
    },
    permissions: {
      confirmed: true,
      confirmedAt: "2026-03-24T00:01:00.000Z"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "mock-openai-gpt-4o-mini"
    },
    channel: {
      channelId: "wechat",
      entryId: "wechat:default"
    },
    channelProgress: {
      status: "staged"
    },
    employee: {
      name: "Alex Morgan",
      jobTitle: "Research Analyst",
      avatarPresetId: "onboarding-analyst"
    }
  });

  const result = await service.complete({ destination: "chat" });

  assert.equal(adapter.gatewayFinalizeCalls, 1);
  assert.equal(result.overview.engine.pendingGatewayApply, false);
  assert.equal(result.overview.engine.running, true);
});

test("onboarding completion leaves the draft intact when runtime finalization fails", async () => {
  class FailingFinalizationAdapter extends MockAdapter {
    override async finalizeOnboardingSetup() {
      return Promise.reject(new Error("Gateway finalization failed."));
    }
  }

  const filePath = resolve(process.cwd(), `apps/daemon/.data/onboarding-service-finalization-failure-${randomUUID()}.json`);
  const adapter = new FailingFinalizationAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const channelSetupService = new ChannelSetupService(adapter, store);
  const aiTeamService = new AITeamService(adapter, store);
  const service = new OnboardingService(adapter, store, overviewService, channelSetupService, aiTeamService);

  await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "installed-managed"
    },
    permissions: {
      confirmed: true,
      confirmedAt: "2026-03-24T00:01:00.000Z"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "mock-openai-gpt-4o-mini"
    },
    channel: {
      channelId: "wechat",
      entryId: "wechat:default"
    },
    channelProgress: {
      status: "staged"
    },
    employee: {
      name: "Alex Morgan",
      jobTitle: "Research Analyst",
      avatarPresetId: "onboarding-analyst"
    }
  });

  await assert.rejects(() => service.complete({ destination: "chat" }), /Gateway finalization failed/i);

  const state = await store.read();
  assert.equal(state.setupCompletedAt, undefined);
  assert.equal(state.onboarding?.draft.currentStep, "employee");
});

test("onboarding completion creates the staged AI employee before clearing onboarding", async () => {
  const { service, store } = createService("onboarding-service-finalize-member");

  await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "installed-managed"
    },
    permissions: {
      confirmed: true,
      confirmedAt: "2026-03-24T00:01:00.000Z"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "mock-openai-gpt-4o-mini"
    },
    channel: {
      channelId: "wechat",
      entryId: "wechat:default"
    },
    channelProgress: {
      status: "staged"
    },
    employee: {
      name: "Alex Morgan",
      jobTitle: "Research Analyst",
      avatarPresetId: "onboarding-analyst",
      presetId: "research-analyst",
      presetSkillIds: ["research-brief", "status-writer"],
      knowledgePackIds: ["company-handbook", "delivery-playbook"],
      workStyles: ["Analytical", "Concise"],
      memoryEnabled: true
    }
  });

  const result = await service.complete({ destination: "team" });
  const persisted = await store.read();
  const storedMembers = Object.values(persisted.aiTeam?.members ?? {});
  const createdMember = storedMembers.find((member) => member.name === "Alex Morgan");

  assert.equal(result.status, "completed");
  assert.ok(createdMember);
  assert.equal(createdMember?.jobTitle, "Research Analyst");
  assert.equal(createdMember?.brain?.entryId, "mock-openai-gpt-4o-mini");
  assert.deepEqual(createdMember?.presetSkillIds, ["research-brief", "status-writer"]);
  assert.equal(persisted.onboarding, undefined);
});

test("onboarding completion repairs legacy employee-step drafts that lost earlier prerequisite fields", async () => {
  const { service } = createService("onboarding-service-repair-legacy-draft");

  await service.updateState({
    currentStep: "employee",
    channel: {
      channelId: "wechat",
      entryId: "wechat:default"
    },
    channelProgress: {
      status: "staged"
    },
    employee: {
      name: "Ai Ryo",
      jobTitle: "AI Assistant",
      avatarPresetId: "onboarding-analyst",
      presetId: "research-analyst",
      presetSkillIds: ["research-brief", "status-writer"],
      knowledgePackIds: ["company-handbook", "delivery-playbook"],
      workStyles: ["Analytical", "Concise"],
      memoryEnabled: true
    }
  });

  const result = await service.complete({ destination: "chat" });

  assert.equal(result.status, "completed");
  assert.equal(result.destination, "chat");
  assert.equal(result.summary.install?.installed, true);
  assert.equal(result.summary.model?.entryId, "mock-openai-gpt-4o-mini");
  assert.equal(result.summary.employee?.name, "Ai Ryo");
});

test("onboarding completion repairs employee-step drafts that lost staged channel state", async () => {
  const { adapter, service, store } = createService("onboarding-service-repair-missing-channel");
  const mockChannels = adapter as unknown as {
    channels: Record<string, { status: string; summary: string; detail: string; lastUpdatedAt?: string }>;
  };
  const lastUpdatedAt = "2026-03-29T03:59:00.000Z";
  mockChannels.channels.wechat = {
    ...mockChannels.channels.wechat,
    status: "completed",
    summary: "Recovered WeChat runtime channel.",
    detail: "Mock OpenClaw still has the WeChat channel configured.",
    lastUpdatedAt
  };

  await store.update((state) => ({
    ...state,
    onboarding: {
      draft: {
        currentStep: "employee",
        install: {
          installed: true,
          version: "2026.3.13",
          disposition: "reused-existing"
        },
        permissions: {
          confirmed: true,
          confirmedAt: "2026-03-24T00:01:00.000Z"
        },
        model: {
          providerId: "openai",
          modelKey: "openai/gpt-4o-mini",
          entryId: "mock-openai-gpt-4o-mini"
        },
        employee: {
          name: "Ai Ryo",
          jobTitle: "AI Assistant",
          avatarPresetId: "onboarding-analyst",
          presetId: "research-analyst",
          presetSkillIds: ["research-brief", "status-writer"],
          knowledgePackIds: ["company-handbook", "delivery-playbook"],
          workStyles: ["Analytical", "Concise"],
          memoryEnabled: true
        }
      }
    }
  }));

  const result = await service.complete({ destination: "chat" });

  assert.equal(result.status, "completed");
  assert.equal(result.summary.channel?.channelId, "wechat");
  assert.equal(result.summary.channel?.entryId, "wechat:default");
});

test("onboarding completion avoids rebuilding expensive live summaries during finalize", async () => {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/onboarding-service-fast-finalize-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  let modelConfigCalls = 0;
  let skillCatalogCalls = 0;
  let runtimeCandidateCalls = 0;
  const originalGetModelConfig = adapter.config.getModelConfig.bind(adapter.config);
  const originalGetSkillRuntimeCatalog = adapter.config.getSkillRuntimeCatalog.bind(adapter.config);
  const originalListAIMemberRuntimeCandidates =
    adapter.aiEmployees.listAIMemberRuntimeCandidates.bind(adapter.aiEmployees);
  adapter.config.getModelConfig = async () => {
    modelConfigCalls += 1;
    return originalGetModelConfig();
  };
  adapter.config.getSkillRuntimeCatalog = async () => {
    skillCatalogCalls += 1;
    return originalGetSkillRuntimeCatalog();
  };
  adapter.aiEmployees.listAIMemberRuntimeCandidates = async () => {
    runtimeCandidateCalls += 1;
    return originalListAIMemberRuntimeCandidates();
  };
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const channelSetupService = new ChannelSetupService(adapter, store);
  const presetSkillService = new PresetSkillService(adapter, store);
  const aiTeamService = new AITeamService(adapter, store, undefined, presetSkillService);
  const service = new OnboardingService(adapter, store, overviewService, channelSetupService, aiTeamService, presetSkillService);

  await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    permissions: {
      confirmed: true,
      confirmedAt: "2026-03-24T00:01:00.000Z"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "mock-openai-gpt-4o-mini"
    },
    channel: {
      channelId: "wechat",
      entryId: "wechat:default"
    },
    channelProgress: {
      status: "staged"
    },
    employee: {
      name: "Ai Ryo",
      jobTitle: "AI Assistant",
      avatarPresetId: "onboarding-analyst",
      presetId: "research-analyst",
      presetSkillIds: ["research-brief", "status-writer"],
      knowledgePackIds: ["company-handbook", "delivery-playbook"],
      workStyles: ["Analytical", "Concise"],
      memoryEnabled: true
    }
  });

  modelConfigCalls = 0;
  skillCatalogCalls = 0;
  runtimeCandidateCalls = 0;

  await service.complete({ destination: "chat" });

  assert.equal(modelConfigCalls, 1);
  assert.equal(skillCatalogCalls, 1);
  assert.equal(runtimeCandidateCalls, 0);
});

test("onboarding service reuses install summary for step-only updates instead of rechecking engine status", async () => {
  const { adapter, service } = createService("onboarding-service-step-only-summary");
  let statusCalls = 0;
  const originalStatus = adapter.instances.status.bind(adapter.instances);
  adapter.instances.status = async () => {
    statusCalls += 1;
    return originalStatus();
  };

  await service.updateState({
    currentStep: "install",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    }
  });

  assert.equal(statusCalls, 1);

  const updated = await service.updateState({
    currentStep: "permissions"
  });

  assert.equal(updated.summary.install?.installed, true);
  assert.equal(updated.summary.install?.version, "2026.3.13");
  assert.equal(statusCalls, 1);
});

test("onboarding service reuses summary when clients send an unchanged draft snapshot for a step transition", async () => {
  const { adapter, service } = createService("onboarding-service-unchanged-draft-summary");
  let statusCalls = 0;
  let modelConfigCalls = 0;
  const originalStatus = adapter.instances.status.bind(adapter.instances);
  const originalModelConfig = adapter.config.getModelConfig.bind(adapter.config);
  adapter.instances.status = async () => {
    statusCalls += 1;
    return originalStatus();
  };
  adapter.config.getModelConfig = async () => {
    modelConfigCalls += 1;
    return originalModelConfig();
  };

  await service.updateState({
    currentStep: "model",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-5",
      entryId: "entry-openai"
    }
  });

  assert.equal(statusCalls, 1);
  assert.equal(modelConfigCalls, 1);

  const updated = await service.updateState({
    currentStep: "channel",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-5",
      entryId: "entry-openai"
    }
  });

  assert.equal(updated.draft.currentStep, "channel");
  assert.equal(updated.summary.model?.entryId, "entry-openai");
  assert.equal(statusCalls, 1);
  assert.equal(modelConfigCalls, 1);
});

test("onboarding summary remaps stale saved model entry ids to the live matching model entry", async () => {
  const { service } = createService("onboarding-service-stale-model-entry");

  const updated = await service.updateState({
    currentStep: "employee",
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "stale-entry-id"
    }
  });

  assert.equal(updated.draft.model?.entryId, "stale-entry-id");
  assert.equal(updated.summary.model?.entryId, "mock-openai-gpt-4o-mini");
  assert.equal(updated.summary.model?.providerId, "openai");
  assert.equal(updated.summary.model?.modelKey, "openai/gpt-4o-mini");
});

test("redo onboarding clears completion state and resets the draft without wiping workspace data", async () => {
  const { service, store } = createService("onboarding-service-reset");

  await store.write({
    selectedProfileId: "email-admin",
    introCompletedAt: "2026-03-24T00:00:00.000Z",
    setupCompletedAt: "2026-03-24T00:05:00.000Z",
    tasks: [],
    onboarding: {
      draft: {
        currentStep: "employee",
        install: {
          installed: true,
          version: "2026.3.13",
          disposition: "reused-existing"
        }
      }
    },
    chat: {
      threads: {
        "thread-1": {
          id: "thread-1",
          memberId: "member-1",
          agentId: "agent-1",
          sessionKey: "session-1",
          title: "Hello",
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z"
        }
      }
    }
  });

  const reset = await service.reset();
  const persisted = await store.read();

  assert.equal(reset.firstRun.setupCompleted, false);
  assert.equal(reset.draft.currentStep, "welcome");
  assert.equal(reset.summary.install, undefined);
  assert.equal(persisted.setupCompletedAt, undefined);
  assert.equal(persisted.onboarding?.draft.currentStep, "welcome");
  assert.ok(persisted.chat?.threads["thread-1"]);
});

test("onboarding state exposes the curated model providers for step 3", async () => {
  const { service } = createService("onboarding-service-curated-providers");

  const state = await service.getState() as OnboardingStateResponse & {
    config?: {
      modelProviders?: Array<{ id: string; label: string }>;
    };
  };

  assert.deepEqual(
    state.config?.modelProviders?.map((provider) => provider.id),
    ["minimax", "modelstudio", "openai"]
  );
  assert.deepEqual(
    state.config?.modelProviders?.map((provider) => provider.label),
    ["MiniMax", "Qwen (通义千问)", "ChatGPT"]
  );
  assert.equal(state.config?.modelProviders?.[0]?.defaultModelKey, "minimax/MiniMax-M2.5");
  assert.deepEqual(state.config?.modelProviders?.[0]?.authMethods.map((method) => method.id), ["minimax-api"]);
  assert.equal(state.config?.modelProviders?.[1]?.defaultModelKey, "modelstudio/qwen3.5-plus");
  assert.deepEqual(state.config?.modelProviders?.[1]?.authMethods.map((method) => method.id), ["modelstudio-api-key-cn"]);
  assert.deepEqual(state.config?.modelProviders?.[2]?.authMethods.map((method) => method.id), ["openai-api-key", "openai-codex"]);
  assert.deepEqual(
    state.config?.channels?.map((channel) => channel.id),
    ["wechat-work", "wechat", "feishu", "telegram"]
  );
  assert.deepEqual(
    state.config?.channels?.map((channel) => channel.label),
    ["WeChat Work (WeCom)", "WeChat", "Feishu", "Telegram"]
  );
  assert.deepEqual(
    state.config?.channels?.map((channel) => channel.setupKind),
    ["wechat-work-guided", "wechat-guided", "feishu-guided", "telegram-guided"]
  );
  assert.deepEqual(
    state.config?.employeePresets?.map((preset) => preset.id),
    ["research-analyst", "support-captain", "delivery-operator"]
  );
  assert.deepEqual(
    state.config?.employeePresets?.map((preset) => preset.avatarPresetId),
    ["onboarding-analyst", "onboarding-guide", "onboarding-builder"]
  );
  assert.deepEqual(state.config?.employeePresets?.[0]?.presetSkillIds, ["research-brief", "status-writer"]);
  assert.deepEqual(state.config?.employeePresets?.[1]?.knowledgePackIds, ["customer-voice"]);
  assert.equal(state.config?.employeePresets?.[2]?.theme, "operator");
});

test("onboarding service fails fast when onboarding config references a missing employee preset id", async () => {
  const onboardingConfigModule = await import("../config/onboarding-config.js");
  assert.throws(
    () =>
      onboardingConfigModule.buildOnboardingUiConfig({
        ...onboardingConfigModule.onboardingUiConfigSelection,
        employeePresetIds: ["research-analyst", "missing-preset-id"]
      }),
    /Unknown onboarding employee preset: missing-preset-id/i
  );
});

test("onboarding service migrates legacy preset skill ids out of the live draft shape", async () => {
  const { service, store } = createService("onboarding-service-legacy-preset-skills");

  await store.write({
    tasks: [],
    onboarding: {
      draft: {
        currentStep: "employee",
        employee: {
          name: "Alex Morgan",
          jobTitle: "Research Analyst",
          avatarPresetId: "onboarding-analyst",
          presetId: "research-analyst",
          skillIds: ["research-brief", "status-writer"]
        } as never
      }
    }
  });

  const state = await service.getState();

  assert.deepEqual(state.draft.employee?.presetSkillIds, ["research-brief", "status-writer"]);
  assert.equal("skillIds" in (state.draft.employee ?? {}), false);
});

test("onboarding service does not reconcile preset skills while editing the employee draft", async () => {
  const filePath = resolve(process.cwd(), `apps/daemon/.data/onboarding-service-preset-skill-reuse-${randomUUID()}.json`);
  const adapter = new MockAdapter();
  const store = new StateStore(filePath);
  const overviewService = new OverviewService(adapter, store);
  const channelSetupService = new ChannelSetupService(adapter, store);
  const presetSkillService = new PresetSkillService(adapter, store);
  const aiTeamService = new AITeamService(adapter, store, undefined, presetSkillService);
  const service = new OnboardingService(adapter, store, overviewService, channelSetupService, aiTeamService, presetSkillService);

  let reconcileCalls = 0;
  const originalSetDesiredPresetSkillIds = presetSkillService.setDesiredPresetSkillIds.bind(presetSkillService);
  presetSkillService.setDesiredPresetSkillIds = async (...args) => {
    reconcileCalls += 1;
    return originalSetDesiredPresetSkillIds(...args);
  };

  await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    employee: {
      name: "Alex Morgan",
      jobTitle: "Research Analyst",
      avatarPresetId: "onboarding-analyst",
      presetId: "research-analyst",
      presetSkillIds: ["research-brief", "status-writer"]
    }
  });

  assert.equal(reconcileCalls, 0);

  const updated = await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    employee: {
      name: "Ryo-AI",
      jobTitle: "Assistant",
      avatarPresetId: "onboarding-analyst",
      presetId: "research-analyst",
      presetSkillIds: ["research-brief", "status-writer"]
    }
  });

  assert.equal(reconcileCalls, 0);
  assert.equal(updated.presetSkillSync?.summary, "No preset skills selected.");
});

test("onboarding completion reconciles staged preset skills during finalize", async () => {
  const { presetSkillService, service } = createService("onboarding-service-finalize-preset-sync");

  const reconcileCalls: Array<{
    scope: string;
    presetSkillIds: string[];
    waitForReconcile: boolean | undefined;
    targetMode: string | undefined;
  }> = [];
  const originalSetDesiredPresetSkillIds = presetSkillService.setDesiredPresetSkillIds.bind(presetSkillService);
  presetSkillService.setDesiredPresetSkillIds = async (scope, presetSkillIds, options) => {
    reconcileCalls.push({
      scope,
      presetSkillIds,
      waitForReconcile: options?.waitForReconcile,
      targetMode: options?.targetMode
    });
    return originalSetDesiredPresetSkillIds(scope, presetSkillIds, options);
  };

  await service.updateState({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.13",
      disposition: "reused-existing"
    },
    permissions: {
      confirmed: true,
      confirmedAt: "2026-03-24T00:01:00.000Z"
    },
    model: {
      providerId: "openai",
      modelKey: "openai/gpt-4o-mini",
      entryId: "mock-openai-gpt-4o-mini"
    },
    channel: {
      channelId: "telegram",
      entryId: "telegram:default"
    },
    channelProgress: {
      status: "staged",
      requiresGatewayApply: true
    },
    employee: {
      name: "Ryo-AI",
      jobTitle: "Research Analyst",
      avatarPresetId: "onboarding-analyst",
      presetId: "research-analyst",
      presetSkillIds: ["research-brief", "status-writer"]
    }
  });

  assert.equal(reconcileCalls.length, 0);

  await service.complete({ destination: "chat" });

  assert.equal(reconcileCalls.length, 1);
  assert.deepEqual(reconcileCalls[0], {
    scope: "onboarding",
    presetSkillIds: ["research-brief", "status-writer"],
    waitForReconcile: true,
    targetMode: "reused-install"
  });
});
