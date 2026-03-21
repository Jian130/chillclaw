import { resolve } from "node:path";

import type {
  AIMemberDetail,
  AITeamActivityItem,
  ChannelFieldSummary,
  ChannelSetupState,
  EngineTaskResult,
  OnboardingDraftState,
  TeamDetail,
  SupportedChannelId
} from "@slackclaw/contracts";
import { FilesystemStateAdapter } from "../platform/filesystem-state-adapter.js";
import { getDataDir } from "../runtime-paths.js";

export interface StoredChannelEntryState {
  id: string;
  channelId: SupportedChannelId;
  label: string;
  editableValues: Record<string, string>;
  maskedConfigSummary: ChannelFieldSummary[];
  lastUpdatedAt: string;
}

export interface ChannelOnboardingState {
  baseOnboardingCompletedAt?: string;
  gatewayStartedAt?: string;
  channels: Record<string, ChannelSetupState>;
  entries?: Record<string, StoredChannelEntryState>;
}

export interface AITeamState {
  teamVision: string;
  members: Record<string, AIMemberDetail>;
  teams: Record<string, TeamDetail>;
  activity: AITeamActivityItem[];
}

export interface StoredCustomSkillState {
  slug: string;
  name: string;
  description: string;
  instructions: string;
  homepage?: string;
  updatedAt: string;
}

export interface SkillState {
  customEntries: Record<string, StoredCustomSkillState>;
}

export interface StoredChatThreadState {
  id: string;
  memberId: string;
  agentId: string;
  sessionKey: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastPreview?: string;
}

export interface ChatState {
  threads: Record<string, StoredChatThreadState>;
}

export interface OnboardingState {
  draft: OnboardingDraftState;
}

export interface AppState {
  selectedProfileId?: string;
  tasks: EngineTaskResult[];
  introCompletedAt?: string;
  setupCompletedAt?: string;
  onboarding?: OnboardingState;
  channelOnboarding?: ChannelOnboardingState;
  aiTeam?: AITeamState;
  skills?: SkillState;
  chat?: ChatState;
}

export function defaultOnboardingDraftState(): OnboardingDraftState {
  return {
    currentStep: "welcome"
  };
}

const DEFAULT_STATE: AppState = {
  selectedProfileId: undefined,
  tasks: []
};

export class StateStore {
  private readonly filePath: string;
  private readonly filesystem: FilesystemStateAdapter;

  constructor(filePath = resolve(getDataDir(), "state.json"), filesystem = new FilesystemStateAdapter()) {
    this.filePath = filePath;
    this.filesystem = filesystem;
  }

  async read(): Promise<AppState> {
    const persisted = await this.filesystem.readJson(this.filePath, DEFAULT_STATE);
    return { ...DEFAULT_STATE, ...persisted } as AppState;
  }

  async write(nextState: AppState): Promise<void> {
    await this.filesystem.writeJson(this.filePath, nextState);
  }

  async update(updater: (current: AppState) => AppState): Promise<AppState> {
    const current = await this.read();
    const next = updater(current);
    await this.write(next);
    return next;
  }
}
