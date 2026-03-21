import type { OnboardingStep, SaveAIMemberRequest, SlackClawEvent } from "@slackclaw/contracts";

import { resolveMemberAvatarPreset } from "../../shared/avatar-presets.js";

export type OnboardingDestination = "team" | "dashboard" | "chat";

export interface OnboardingEmployeeDraft {
  name: string;
  jobTitle: string;
  avatarPresetId: string;
  personalityTraits: string[];
  skillIds: string[];
  memoryEnabled: boolean;
  brainEntryId: string;
}

export function onboardingDestinationPath(destination: OnboardingDestination): string {
  switch (destination) {
    case "team":
      return "/team";
    case "chat":
      return "/chat";
    case "dashboard":
    default:
      return "/";
  }
}

export function buildOnboardingMemberRequest(draft: OnboardingEmployeeDraft): SaveAIMemberRequest {
  const personality = draft.personalityTraits.join(", ");
  const avatarPreset = resolveMemberAvatarPreset(draft.avatarPresetId);

  return {
    name: draft.name.trim(),
    jobTitle: draft.jobTitle.trim(),
    avatar: {
      presetId: avatarPreset.id,
      accent: avatarPreset.accent,
      emoji: avatarPreset.emoji,
      theme: avatarPreset.theme
    },
    brainEntryId: draft.brainEntryId,
    personality,
    soul: personality,
    workStyles: [],
    skillIds: draft.skillIds,
    knowledgePackIds: [],
    capabilitySettings: {
      memoryEnabled: draft.memoryEnabled,
      contextWindow: 128000
    }
  };
}

export type OnboardingRefreshResource = "overview" | "model" | "channel" | "team";

export function onboardingRefreshResourceForEvent(
  step: OnboardingStep,
  event: SlackClawEvent
): OnboardingRefreshResource | undefined {
  switch (step) {
    case "install":
      return event.type === "deploy.completed" || event.type === "gateway.status" ? "overview" : undefined;
    case "model":
      return event.type === "config.applied" && event.resource === "models" ? "model" : undefined;
    case "channel":
      if (event.type === "config.applied" && event.resource === "channels") {
        return "channel";
      }
      return event.type === "channel.session.updated" ? "channel" : undefined;
    case "employee":
    case "complete":
      if (event.type !== "config.applied") {
        return undefined;
      }
      return ["ai-employees", "models", "skills"].includes(event.resource) ? "team" : undefined;
    case "welcome":
    default:
      return undefined;
  }
}
