import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAITeamOverview, fetchOverview } from "./client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API client GET dedupe", () => {
  it("reuses one browser request for identical concurrent GETs", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: true; json: () => Promise<{ appName: string }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ appName: "SlackClaw" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([fetchOverview(), fetchOverview()]);

    expect(first).toEqual({ appName: "SlackClaw" });
    expect(second).toEqual({ appName: "SlackClaw" });
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
});
