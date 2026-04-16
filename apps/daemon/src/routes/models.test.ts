import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultProductOverview, type LocalModelRuntimeOverview, type ModelConfigOverview } from "@chillclaw/contracts";

import { modelsRoutes } from "./models.js";
import type { ServerContext } from "./server-context.js";

function emptyModelConfig(localRuntime?: LocalModelRuntimeOverview): ModelConfigOverview {
  return {
    providers: [],
    models: [],
    configuredModelKeys: [],
    savedEntries: [],
    fallbackEntryIds: [],
    localRuntime
  };
}

test("local runtime install route returns onboarding after adopting the active local model", async () => {
  const route = modelsRoutes.find((candidate) => candidate.method === "POST" && candidate.match("/api/models/local-runtime/install"));
  assert.ok(route);

  const localRuntime: LocalModelRuntimeOverview = {
    supported: true,
    recommendation: "local",
    supportCode: "supported",
    status: "ready",
    runtimeInstalled: true,
    runtimeReachable: true,
    modelDownloaded: true,
    activeInOpenClaw: true,
    chosenModelKey: "ollama/gemma4:e2b",
    managedEntryId: "runtime:ollama-gemma4-e2b",
    summary: "Local AI is ready on this Mac.",
    detail: "OpenClaw is already pointed at the local Ollama runtime."
  };
  let adoptedRuntime: LocalModelRuntimeOverview | undefined;
  const modelConfig = emptyModelConfig(localRuntime);
  const productOverview = { ...createDefaultProductOverview(), localRuntime };
  const context = {
    localModelRuntimeService: {
      install: async () => ({
        status: "completed" as const,
        message: "Local AI is ready on this Mac.",
        localRuntime
      }),
      decorateModelConfig: async () => modelConfig
    },
    adapter: {
      config: {
        getModelConfig: async () => emptyModelConfig()
      }
    },
    eventPublisher: {
      publishModelConfigUpdated: () => ({
        epoch: "epoch-1",
        revision: 1,
        settled: true
      }),
      publishOverviewUpdated: () => undefined
    },
    overviewService: {
      getOverview: async () => productOverview
    },
    onboardingService: {
      adoptActiveLocalRuntimeModel: async (runtime: LocalModelRuntimeOverview) => {
        adoptedRuntime = runtime;
        return {
          firstRun: {
            introCompleted: true,
            setupCompleted: false
          },
          draft: {
            currentStep: "model" as const,
            install: {
              installed: true,
              version: "2026.4.5",
              disposition: "installed-managed" as const
            },
            model: {
              providerId: "ollama",
              methodId: "ollama-local",
              modelKey: "ollama/gemma4:e2b",
              entryId: "runtime:ollama-gemma4-e2b"
            }
          },
          config: {
            modelProviders: [],
            channels: [],
            employeePresets: []
          },
          summary: {
            model: {
              providerId: "ollama",
              modelKey: "ollama/gemma4:e2b",
              entryId: "runtime:ollama-gemma4-e2b"
            }
          },
          localRuntime
        };
      }
    }
  } as unknown as ServerContext;

  const response = await route.handle({
    context,
    request: {} as never,
    requestUrl: new URL("http://127.0.0.1/api/models/local-runtime/install"),
    pathname: "/api/models/local-runtime/install",
    params: {}
  });

  assert.equal(adoptedRuntime, localRuntime);
  assert.equal((response.body as { onboarding?: { draft?: { model?: { entryId?: string } } } }).onboarding?.draft?.model?.entryId, "runtime:ollama-gemma4-e2b");
});
