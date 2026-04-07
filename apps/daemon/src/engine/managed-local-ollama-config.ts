import {
  MANAGED_LOCAL_OLLAMA_API_KEY,
  MANAGED_LOCAL_OLLAMA_BASE_URL,
  findLocalModelTierByKey
} from "../config/local-model-runtime-catalog.js";

type ManagedLocalOllamaEntryLike = {
  providerId: string;
  authMethodId?: string;
  modelKey: string;
};

type ManagedLocalOllamaProviderModel = {
  id?: string;
  name?: string;
  reasoning?: boolean;
  input?: string[];
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  contextWindow?: number;
  maxTokens?: number;
};

type ManagedLocalOllamaConfigLike = {
  [key: string]: unknown;
  models?: {
    mode?: string;
    providers?: Record<
      string,
      {
        baseUrl?: string;
        api?: string;
        apiKey?: string;
        models?: ManagedLocalOllamaProviderModel[];
      }
    >;
  };
};

function isManagedLocalOllamaEntry(entry: ManagedLocalOllamaEntryLike): boolean {
  return entry.providerId === "ollama" && entry.authMethodId === "ollama-local";
}

function buildManagedLocalOllamaProviderModels(entries: ManagedLocalOllamaEntryLike[]): ManagedLocalOllamaProviderModel[] {
  return [...new Set(entries.filter(isManagedLocalOllamaEntry).map((entry) => entry.modelKey))].map((modelKey) => {
    const tier = findLocalModelTierByKey(modelKey);
    const modelTag = tier?.modelTag ?? modelKey.replace(/^ollama\//, "");

    return {
      id: modelTag,
      name: modelTag,
      reasoning: tier?.reasoning ?? false,
      input: ["text"],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      },
      contextWindow: tier?.contextWindow ?? 131072,
      maxTokens: tier?.maxTokens ?? 8192
    };
  });
}

export function syncManagedLocalOllamaProviderConfig(
  config: ManagedLocalOllamaConfigLike,
  entries: ManagedLocalOllamaEntryLike[]
): void {
  const managedModels = buildManagedLocalOllamaProviderModels(entries);

  if (managedModels.length === 0) {
    return;
  }

  config.models = config.models ?? {};
  config.models.mode = config.models.mode?.trim() ? config.models.mode : "merge";
  config.models.providers = config.models.providers ?? {};
  config.models.providers.ollama = {
    ...config.models.providers.ollama,
    baseUrl: MANAGED_LOCAL_OLLAMA_BASE_URL,
    api: "ollama",
    apiKey: MANAGED_LOCAL_OLLAMA_API_KEY,
    models: managedModels
  };
}
