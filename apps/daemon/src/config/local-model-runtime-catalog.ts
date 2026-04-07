export interface LocalModelHostSnapshot {
  platform: string;
  architecture: string;
  totalMemoryGb: number;
  freeDiskGb: number;
}

export interface LocalModelTierDefinition {
  id: "small" | "medium" | "large";
  label: string;
  modelTag: string;
  modelKey: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  estimatedModelSizeGb: number;
  requiredDiskGb: number;
  minimumMemoryGb: number;
}

export const MANAGED_LOCAL_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const MANAGED_LOCAL_OLLAMA_API_KEY = "ollama-local";

export const OLLAMA_STARTER_MODEL_TIERS: LocalModelTierDefinition[] = [
  {
    id: "small",
    label: "Balanced small",
    modelTag: "gemma4:e2b",
    modelKey: "ollama/gemma4:e2b",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: false,
    estimatedModelSizeGb: 7.2,
    requiredDiskGb: 12,
    minimumMemoryGb: 16
  },
  {
    id: "medium",
    label: "Balanced medium",
    modelTag: "gemma4:e4b",
    modelKey: "ollama/gemma4:e4b",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: false,
    estimatedModelSizeGb: 9.6,
    requiredDiskGb: 16,
    minimumMemoryGb: 32
  },
  {
    id: "large",
    label: "Balanced large",
    modelTag: "gemma4:26b",
    modelKey: "ollama/gemma4:26b",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: false,
    estimatedModelSizeGb: 18,
    requiredDiskGb: 32,
    minimumMemoryGb: 64
  }
];

export function chooseLocalModelTier(host: LocalModelHostSnapshot): LocalModelTierDefinition | undefined {
  return OLLAMA_STARTER_MODEL_TIERS.find((tier) => host.totalMemoryGb >= tier.minimumMemoryGb && host.freeDiskGb >= tier.requiredDiskGb);
}

export function findLocalModelTierByKey(modelKey: string): LocalModelTierDefinition | undefined {
  return OLLAMA_STARTER_MODEL_TIERS.find((tier) => tier.modelKey === modelKey);
}
