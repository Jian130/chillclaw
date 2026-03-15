import type { EngineKind } from "./index.js";

export type EngineCompatibilityCapabilityId =
  | "detect-runtime"
  | "install-managed-runtime"
  | "update-runtime"
  | "uninstall-runtime"
  | "fetch-deployment-targets"
  | "add-model"
  | "modify-model"
  | "remove-model"
  | "set-default-model"
  | "set-fallback-model"
  | "add-channel"
  | "modify-channel"
  | "remove-channel"
  | "restart-gateway"
  | "verify-gateway-health"
  | "run-task-through-default-model"
  | "list-members"
  | "create-member"
  | "update-member"
  | "delete-member"
  | "list-teams"
  | "create-team"
  | "update-team"
  | "delete-team"
  | "run-task-with-member-agent"
  | "list-chat-threads"
  | "create-chat-thread"
  | "load-chat-history"
  | "send-chat-message"
  | "abort-chat-message";

export type EngineCompatibilityRuntimeMode = "system" | "managed";
export type EngineCompatibilityCheckStatus = "passed" | "failed" | "not-supported" | "skipped";

export interface EngineCompatibilityCapabilityDefinition {
  id: EngineCompatibilityCapabilityId;
  label: string;
  description: string;
}

export interface EngineCompatibilityManifest {
  engine: EngineKind;
  supportedCapabilityIds: EngineCompatibilityCapabilityId[];
}

export interface EngineCompatibilityCheckResult {
  capabilityId: EngineCompatibilityCapabilityId;
  runtimeMode: EngineCompatibilityRuntimeMode;
  status: EngineCompatibilityCheckStatus;
  summary: string;
  engineVersion?: string;
  command?: string;
  affectedAreas: string[];
  likelyFilePaths: string[];
  logPath?: string;
}

export interface EngineCompatibilityRuntimeReport {
  runtimeMode: EngineCompatibilityRuntimeMode;
  detectedVersion?: string;
  checks: EngineCompatibilityCheckResult[];
}

export interface EngineCompatibilityReport {
  engine: EngineKind;
  generatedAt: string;
  candidateVersion?: string;
  staticChecks: {
    build: EngineCompatibilityCheckStatus;
    test: EngineCompatibilityCheckStatus;
  };
  runtimes: EngineCompatibilityRuntimeReport[];
}

export const engineCompatibilityCapabilities: EngineCompatibilityCapabilityDefinition[] = [
  {
    id: "detect-runtime",
    label: "Detect runtime",
    description: "Verify SlackClaw can identify an installed engine runtime and read its version."
  },
  {
    id: "install-managed-runtime",
    label: "Install managed runtime",
    description: "Verify SlackClaw can provision a self-contained managed runtime."
  },
  {
    id: "update-runtime",
    label: "Update runtime",
    description: "Verify SlackClaw can inspect or preview runtime updates."
  },
  {
    id: "uninstall-runtime",
    label: "Uninstall runtime",
    description: "Verify SlackClaw can remove a managed runtime or report system uninstall limits."
  },
  {
    id: "fetch-deployment-targets",
    label: "Fetch deployment targets",
    description: "Verify SlackClaw can resolve deployment target status for the engine."
  },
  {
    id: "add-model",
    label: "Add model",
    description: "Verify SlackClaw can create a saved model entry for the engine."
  },
  {
    id: "modify-model",
    label: "Modify model",
    description: "Verify SlackClaw can update an existing saved model entry."
  },
  {
    id: "remove-model",
    label: "Remove model",
    description: "Verify SlackClaw can delete a saved model entry."
  },
  {
    id: "set-default-model",
    label: "Set default model",
    description: "Verify SlackClaw can switch the active default model entry."
  },
  {
    id: "set-fallback-model",
    label: "Set fallback model",
    description: "Verify SlackClaw can update the active fallback model chain."
  },
  {
    id: "add-channel",
    label: "Add channel",
    description: "Verify SlackClaw can add a channel account."
  },
  {
    id: "modify-channel",
    label: "Modify channel",
    description: "Verify SlackClaw can modify an existing channel account."
  },
  {
    id: "remove-channel",
    label: "Remove channel",
    description: "Verify SlackClaw can remove a channel account."
  },
  {
    id: "restart-gateway",
    label: "Restart gateway",
    description: "Verify SlackClaw can restart the engine gateway."
  },
  {
    id: "verify-gateway-health",
    label: "Verify gateway health",
    description: "Verify SlackClaw can confirm the gateway is reachable and healthy enough for work."
  },
  {
    id: "run-task-through-default-model",
    label: "Run task through default model",
    description: "Verify SlackClaw tasks run through the selected default model entry."
  },
  {
    id: "list-members",
    label: "List AI members",
    description: "Verify SlackClaw can load daemon-backed AI members mapped to engine agents."
  },
  {
    id: "create-member",
    label: "Create AI member",
    description: "Verify SlackClaw can create an AI member and provision its engine agent."
  },
  {
    id: "update-member",
    label: "Update AI member",
    description: "Verify SlackClaw can update an AI member without replacing its agent."
  },
  {
    id: "delete-member",
    label: "Delete AI member",
    description: "Verify SlackClaw can delete an AI member and remove its engine agent."
  },
  {
    id: "list-teams",
    label: "List AI teams",
    description: "Verify SlackClaw can load daemon-backed AI team data."
  },
  {
    id: "create-team",
    label: "Create AI team",
    description: "Verify SlackClaw can create an AI team and persist membership."
  },
  {
    id: "update-team",
    label: "Update AI team",
    description: "Verify SlackClaw can update team metadata and roster membership."
  },
  {
    id: "delete-team",
    label: "Delete AI team",
    description: "Verify SlackClaw can delete a team without deleting its members."
  },
  {
    id: "run-task-with-member-agent",
    label: "Run task with member agent",
    description: "Verify SlackClaw can route a task through a selected AI member agent."
  },
  {
    id: "list-chat-threads",
    label: "List chat threads",
    description: "Verify SlackClaw can load chat threads for AI member conversations."
  },
  {
    id: "create-chat-thread",
    label: "Create chat thread",
    description: "Verify SlackClaw can create a new chat thread for an AI member."
  },
  {
    id: "load-chat-history",
    label: "Load chat history",
    description: "Verify SlackClaw can reload chat history from an OpenClaw-backed session."
  },
  {
    id: "send-chat-message",
    label: "Send chat message",
    description: "Verify SlackClaw can send a chat message through the selected AI member agent."
  },
  {
    id: "abort-chat-message",
    label: "Abort chat message",
    description: "Verify SlackClaw can stop an in-flight assistant reply."
  }
];

export const engineCompatibilityManifests: Record<EngineKind, EngineCompatibilityManifest> = {
  openclaw: {
    engine: "openclaw",
    supportedCapabilityIds: engineCompatibilityCapabilities.map((capability) => capability.id)
  },
  zeroclaw: {
    engine: "zeroclaw",
    supportedCapabilityIds: []
  },
  ironclaw: {
    engine: "ironclaw",
    supportedCapabilityIds: []
  }
};
