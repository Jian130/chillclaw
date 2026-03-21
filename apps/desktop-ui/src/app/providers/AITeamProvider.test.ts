import { describe, expect, it } from "vitest";

import { shouldRefreshAITeamForEvent } from "./AITeamProvider.js";

describe("AITeamProvider helpers", () => {
  it("refreshes AI team state for relevant config resources", () => {
    expect(
      shouldRefreshAITeamForEvent({
        type: "config.applied",
        resource: "ai-employees",
        summary: "AI employees saved."
      })
    ).toBe(true);

    expect(
      shouldRefreshAITeamForEvent({
        type: "config.applied",
        resource: "models",
        summary: "Models saved."
      })
    ).toBe(true);

    expect(
      shouldRefreshAITeamForEvent({
        type: "config.applied",
        resource: "skills",
        summary: "Skills saved."
      })
    ).toBe(true);
  });

  it("ignores unrelated daemon events", () => {
    expect(
      shouldRefreshAITeamForEvent({
        type: "config.applied",
        resource: "channels",
        summary: "Channels saved."
      })
    ).toBe(false);

    expect(
      shouldRefreshAITeamForEvent({
        type: "gateway.status",
        reachable: true,
        pendingGatewayApply: false,
        summary: "Gateway ready."
      })
    ).toBe(false);
  });
});
