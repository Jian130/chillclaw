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
  estimatedModelSizeGb: number;
  requiredDiskGb: number;
  minimumMemoryGb: number;
}

export const OLLAMA_STARTER_MODEL_TIERS: LocalModelTierDefinition[] = [
  {
    id: "small",
    label: "Balanced small",
    modelTag: "gemma4:e2b",
    modelKey: "ollama/gemma4:e2b",
    estimatedModelSizeGb: 7.2,
    requiredDiskGb: 12,
    minimumMemoryGb: 16
  },
  {
    id: "medium",
    label: "Balanced medium",
    modelTag: "gemma4:e4b",
    modelKey: "ollama/gemma4:e4b",
    estimatedModelSizeGb: 9.6,
    requiredDiskGb: 16,
    minimumMemoryGb: 32
  },
  {
    id: "large",
    label: "Balanced large",
    modelTag: "gemma4:26b",
    modelKey: "ollama/gemma4:26b",
    estimatedModelSizeGb: 18,
    requiredDiskGb: 32,
    minimumMemoryGb: 64
  }
];

export function chooseLocalModelTier(host: LocalModelHostSnapshot): LocalModelTierDefinition | undefined {
  return [...OLLAMA_STARTER_MODEL_TIERS]
    .reverse()
    .find((tier) => host.totalMemoryGb >= tier.minimumMemoryGb && host.freeDiskGb >= tier.requiredDiskGb);
}
