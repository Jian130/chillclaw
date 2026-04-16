import starterModelTiers from "./local-model-runtime-catalog.json" with { type: "json" };

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

export const OLLAMA_STARTER_MODEL_TIERS = starterModelTiers as LocalModelTierDefinition[];

export function minimumLocalModelMemoryGb(): number {
  return Math.min(...OLLAMA_STARTER_MODEL_TIERS.map((tier) => tier.minimumMemoryGb));
}

export function chooseLocalModelTier(host: LocalModelHostSnapshot): LocalModelTierDefinition | undefined {
  return OLLAMA_STARTER_MODEL_TIERS.find((tier) => host.totalMemoryGb >= tier.minimumMemoryGb && host.freeDiskGb >= tier.requiredDiskGb);
}

export function findLocalModelTierByKey(modelKey: string): LocalModelTierDefinition | undefined {
  return OLLAMA_STARTER_MODEL_TIERS.find((tier) => tier.modelKey === modelKey);
}
