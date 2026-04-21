import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAIMember,
  completeOnboarding,
  fetchAITeamOverview,
  fetchCapabilityOverview,
  fetchPluginConfig,
  fetchOverview,
  fetchToolOverview,
  redoOnboarding,
  resetClientReadStateForTests,
  saveOnboardingChannelEntry,
  saveOnboardingModelEntry,
  updateOnboardingRuntime,
  updateOnboardingChannelEntry,
  updatePlugin
} from "./client.js";

afterEach(() => {
  resetClientReadStateForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API client GET dedupe", () => {
  it("reuses one browser request for identical concurrent GETs", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ appName: string }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ appName: "ChillClaw" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([fetchOverview(), fetchOverview()]);

    expect(first).toEqual({ appName: "ChillClaw" });
    expect(second).toEqual({ appName: "ChillClaw" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("appends fresh=1 for manual refresh reads", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ members: never[] }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ members: [] })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAITeamOverview({ fresh: true });

    const firstCall = fetchMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0] ?? "")).toContain("/ai-team/overview?fresh=1");
  });

  it("reuses a recent successful GET result for a short follow-up read", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ appName: string }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ appName: "ChillClaw" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchOverview();
    const second = await fetchOverview();

    expect(first).toEqual({ appName: "ChillClaw" });
    expect(second).toEqual({ appName: "ChillClaw" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears cached GET results after a mutation succeeds", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<unknown> }>
    >(async (input) => ({
      ok: true,
      json: async () =>
        String(input).includes("/ai-members")
          ? { overview: { members: [] } }
          : { members: [] }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAITeamOverview();
    await createAIMember({
      name: "Test",
      jobTitle: "Analyst",
      avatar: { presetId: "operator", accent: "#000", emoji: "🦊", theme: "sunrise" },
      brainEntryId: "brain-1",
      personality: "",
      soul: "",
      workStyles: [],
      skillIds: [],
      knowledgePackIds: [],
      capabilitySettings: { memoryEnabled: true, contextWindow: 128000 }
    });
    await fetchAITeamOverview();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("posts to the onboarding reset endpoint", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ draft: { currentStep: string } }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ draft: { currentStep: "welcome" } })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await redoOnboarding();

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/onboarding/reset");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("treats plugin config like the other cached daemon snapshots", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ entries: never[] }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ entries: [] })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPluginConfig();
    await fetchPluginConfig();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats capability and tool overviews like cached daemon snapshots", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ entries: never[] }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ entries: [] })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCapabilityOverview();
    await fetchCapabilityOverview();
    await fetchToolOverview();
    await fetchToolOverview();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/capabilities/overview");
    expect(String(fetchMock.mock.calls[1]?.[0] ?? "")).toContain("/tools/overview");
  });

  it("posts plugin update mutations to the dedicated plugin endpoint", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ message: string; pluginConfig: { entries: never[] } }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ message: "Updated", pluginConfig: { entries: [] } })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await updatePlugin("wecom");

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/plugins/wecom/update");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("posts onboarding runtime update as a quick operation command", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<unknown> }>
    >(async () => ({
      ok: true,
      json: async () => ({
        accepted: true,
        operation: {
          operationId: "onboarding:install",
          scope: "onboarding",
          action: "onboarding-runtime-update",
          status: "running",
          message: "Updating OpenClaw locally.",
          startedAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z"
        },
        onboarding: {
          firstRun: { introCompleted: true, setupCompleted: false },
          draft: { currentStep: "install" },
          config: { modelProviders: [], channels: [], employeePresets: [] },
          summary: {}
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await updateOnboardingRuntime();

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/onboarding/runtime/update");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("posts onboarding completion as a quick operation command", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<unknown> }>>(
      async () => ({
        ok: true,
        json: async () => ({
          accepted: true,
          operation: {
            operationId: "onboarding:completion",
            scope: "onboarding",
            action: "onboarding-completion",
            status: "running",
            phase: "finalizing",
            message: "Finishing onboarding.",
            startedAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z"
          },
          onboarding: {
            firstRun: { introCompleted: true, setupCompleted: false },
            draft: { currentStep: "employee" },
            config: { modelProviders: [], channels: [], employeePresets: [] },
            summary: {}
          },
          destination: "dashboard"
        })
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await completeOnboarding({ destination: "dashboard" });

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/onboarding/complete");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("posts onboarding model save as a quick operation command", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<unknown> }>>(
      async () => ({
        ok: true,
        json: async () => ({
          accepted: true,
          operation: {
            operationId: "onboarding:model",
            scope: "onboarding",
            action: "onboarding-model-save",
            status: "running",
            phase: "saving-model",
            message: "Saving the first model.",
            startedAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z"
          },
          onboarding: {
            firstRun: { introCompleted: true, setupCompleted: false },
            draft: { currentStep: "model" },
            config: { modelProviders: [], channels: [], employeePresets: [] },
            summary: {}
          }
        })
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await saveOnboardingModelEntry({
      label: "Claude",
      providerId: "anthropic",
      methodId: "api-key",
      modelKey: "claude",
      values: {},
      makeDefault: true
    });

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/onboarding/model/entries");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("posts onboarding channel saves as quick operation commands", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<unknown> }>>(
      async () => ({
        ok: true,
        json: async () => ({
          accepted: true,
          operation: {
            operationId: "onboarding:channel",
            scope: "onboarding",
            action: "onboarding-channel-save",
            status: "running",
            phase: "saving-channel",
            message: "Saving the first channel.",
            startedAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z"
          },
          onboarding: {
            firstRun: { introCompleted: true, setupCompleted: false },
            draft: { currentStep: "channel" },
            config: { modelProviders: [], channels: [], employeePresets: [] },
            summary: {}
          }
        })
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await saveOnboardingChannelEntry({ channelId: "wechat", values: {}, action: "save" });
    await updateOnboardingChannelEntry("entry-1", { channelId: "wechat", values: {}, action: "save" });

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/onboarding/channel/entries");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeUndefined();
    expect(String(fetchMock.mock.calls[1]?.[0] ?? "")).toContain("/onboarding/channel/entries/entry-1");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBeUndefined();
  });
});
