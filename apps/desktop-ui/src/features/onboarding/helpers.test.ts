import { describe, expect, it } from "vitest";

import type { OnboardingStep, SlackClawEvent } from "@slackclaw/contracts";

import { buildOnboardingMemberRequest, onboardingDestinationPath, onboardingRefreshResourceForEvent } from "./helpers.js";

describe("onboarding helpers", () => {
  it("maps the final destination buttons to app routes", () => {
    expect(onboardingDestinationPath("team")).toBe("/team");
    expect(onboardingDestinationPath("dashboard")).toBe("/");
    expect(onboardingDestinationPath("chat")).toBe("/chat");
  });

  it("builds the onboarding AI employee request with deterministic hidden fields", () => {
    const request = buildOnboardingMemberRequest({
      name: "Alex Morgan",
      jobTitle: "Research Analyst",
      avatarPresetId: "onboarding-analyst",
      personalityTraits: ["Analytical", "Detail-Oriented"],
      skillIds: ["research", "summarization"],
      memoryEnabled: true,
      brainEntryId: "brain-1"
    });

    expect(request).toEqual({
      name: "Alex Morgan",
      jobTitle: "Research Analyst",
      avatar: {
        presetId: "onboarding-analyst",
        accent: "#97b5ea",
        emoji: "🧠",
        theme: "onboarding"
      },
      brainEntryId: "brain-1",
      personality: "Analytical, Detail-Oriented",
      soul: "Analytical, Detail-Oriented",
      workStyles: [],
      skillIds: ["research", "summarization"],
      knowledgePackIds: [],
      capabilitySettings: {
        memoryEnabled: true,
        contextWindow: 128000
      }
    });
  });

  it("maps daemon events to onboarding refresh resources by step", () => {
    const installEvent: SlackClawEvent = {
      type: "deploy.completed",
      correlationId: "install-1",
      targetId: "managed-local",
      status: "completed",
      message: "Installed.",
      engineStatus: {
        engine: "openclaw",
        installed: true,
        running: false,
        summary: "Installed",
        lastCheckedAt: "2026-03-21T00:00:00.000Z"
      }
    };
    const modelEvent: SlackClawEvent = { type: "config.applied", resource: "models", summary: "Models updated." };
    const channelEvent: SlackClawEvent = { type: "config.applied", resource: "channels", summary: "Channels updated." };
    const employeeEvent: SlackClawEvent = { type: "config.applied", resource: "ai-employees", summary: "Members updated." };

    expect(onboardingRefreshResourceForEvent("install", installEvent)).toBe("overview");
    expect(onboardingRefreshResourceForEvent("model", modelEvent)).toBe("model");
    expect(onboardingRefreshResourceForEvent("channel", channelEvent)).toBe("channel");
    expect(onboardingRefreshResourceForEvent("employee", employeeEvent)).toBe("team");
  });

  it("ignores unrelated daemon events during onboarding", () => {
    const unrelatedEvent: SlackClawEvent = {
      type: "task.progress",
      taskId: "task-1",
      status: "running",
      message: "Working"
    };

    const steps: OnboardingStep[] = ["welcome", "install", "model", "channel", "employee", "complete"];
    for (const step of steps) {
      expect(onboardingRefreshResourceForEvent(step, unrelatedEvent)).toBeUndefined();
    }
  });
});
