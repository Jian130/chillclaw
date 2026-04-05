import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type {
  GatewayActionResponse,
  ModelConfigActionResponse,
  ModelConfigOverview
} from "@chillclaw/contracts";

import {
  LocalModelRuntimeService,
  resolveInstalledRuntimeCandidate,
  resolveDiskProbePath,
  type PersistedLocalModelRuntimeState
} from "./local-model-runtime-service.js";

type LocalModelRuntimeAccess = ConstructorParameters<typeof LocalModelRuntimeService>[0];

function createEmptyModelConfig(): ModelConfigOverview {
  return {
    providers: [],
    models: [],
    configuredModelKeys: [],
    savedEntries: [],
    defaultModel: undefined,
    defaultEntryId: undefined,
    fallbackEntryIds: []
  };
}

function createHarness(overrides: Partial<LocalModelRuntimeAccess> = {}) {
  const pullCalls: string[] = [];
  const restartCalls: string[] = [];
  const upsertCalls: Array<{ label: string; providerId: string; methodId: string; modelKey: string; entryId?: string }> = [];
  const publishedProgress: string[] = [];
  const publishedCompleted: string[] = [];

  let persistedState: PersistedLocalModelRuntimeState | undefined;
  let reachable = false;
  let modelAvailable = false;

  const access: LocalModelRuntimeAccess = {
    inspectHost: async () => ({
      platform: "darwin",
      architecture: "arm64",
      totalMemoryGb: 36,
      freeDiskGb: 128
    }),
    readPersistedState: async () => persistedState,
    writePersistedState: async (nextState) => {
      persistedState = nextState;
    },
    fetchModelConfig: async () => createEmptyModelConfig(),
    resolveInstalledRuntime: async () => ({
      command: "/usr/local/bin/ollama",
      source: "existing-install",
      managed: false
    }),
    installManagedRuntime: async () => ({
      command: "/tmp/chillclaw/Ollama.app/Contents/Resources/ollama",
      source: "managed-install",
      managed: true
    }),
    isRuntimeReachable: async () => reachable,
    startRuntime: async () => {
      reachable = true;
    },
    isModelAvailable: async () => modelAvailable,
    pullModel: async (_runtime, modelTag, publishMessage) => {
      pullCalls.push(modelTag);
      publishMessage(`pulling ${modelTag}`);
      modelAvailable = true;
    },
    upsertManagedLocalModelEntry: async (request) => {
      upsertCalls.push(request);
      const response: ModelConfigActionResponse = {
        epoch: "daemon-local",
        revision: 1,
        settled: true,
        status: "completed",
        message: "Connected local Ollama to OpenClaw.",
        modelConfig: {
          ...createEmptyModelConfig(),
          defaultModel: request.modelKey,
          configuredModelKeys: [request.modelKey],
          savedEntries: [
            {
              id: request.entryId ?? "managed-ollama-entry",
              label: request.label,
              providerId: request.providerId,
              modelKey: request.modelKey,
              agentId: "",
              authMethodId: request.methodId,
              authModeLabel: "Local runtime",
              profileLabel: undefined,
              isDefault: true,
              isFallback: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          defaultEntryId: request.entryId ?? "managed-ollama-entry"
        }
      };
      return response;
    },
    restartGateway: async () => {
      restartCalls.push("restart");
      const response: GatewayActionResponse = {
        action: "restart-gateway",
        status: "completed",
        message: "Gateway restarted.",
        engineStatus: {
          engine: "openclaw",
          installed: true,
          running: true,
          version: "2026.4.5",
          summary: "Gateway restarted.",
          pendingGatewayApply: false,
          lastCheckedAt: new Date().toISOString()
        }
      };
      return response;
    },
    publishProgress: (_action, _phase, message) => {
      publishedProgress.push(message);
    },
    publishCompleted: (_action, _status, message) => {
      publishedCompleted.push(message);
    },
    ...overrides
  };

  return {
    service: new LocalModelRuntimeService(access),
    getPersistedState: () => persistedState,
    pullCalls,
    restartCalls,
    upsertCalls,
    publishedProgress,
    publishedCompleted
  };
}

test("local runtime overview recommends the medium Ollama tier for a 36 GB Apple Silicon Mac", async () => {
  const { service } = createHarness();

  const overview = await service.getOverview();

  assert.equal(overview.supported, true);
  assert.equal(overview.recommendation, "local");
  assert.equal(overview.recommendedTier, "medium");
  assert.equal(overview.chosenModelKey, "ollama/gemma4:e4b");
});

test("local runtime overview falls back to cloud setup on underpowered Macs", async () => {
  const { service } = createHarness({
    inspectHost: async () => ({
      platform: "darwin",
      architecture: "arm64",
      totalMemoryGb: 8,
      freeDiskGb: 128
    })
  });

  const overview = await service.getOverview();

  assert.equal(overview.supported, false);
  assert.equal(overview.recommendation, "cloud");
  assert.equal(overview.supportCode, "insufficient-memory");
  assert.equal(overview.status, "cloud-recommended");
});

test("install reuses an existing Ollama runtime, downloads the selected model, and wires OpenClaw to it", async () => {
  const { service, getPersistedState, pullCalls, restartCalls, upsertCalls, publishedProgress, publishedCompleted } = createHarness();

  const result = await service.install();

  assert.equal(result.status, "completed");
  assert.equal(result.localRuntime.status, "ready");
  assert.deepEqual(pullCalls, ["gemma4:e4b"]);
  assert.equal(upsertCalls[0]?.providerId, "ollama");
  assert.equal(upsertCalls[0]?.modelKey, "ollama/gemma4:e4b");
  assert.equal(restartCalls.length, 1);
  assert.equal(getPersistedState()?.managedEntryId, "managed-ollama-entry");
  assert.equal(getPersistedState()?.selectedModelKey, "ollama/gemma4:e4b");
  assert.equal(publishedProgress.some((message) => message.includes("pulling gemma4:e4b")), true);
  assert.equal(publishedCompleted.at(-1), result.message);
});

test("resolveInstalledRuntimeCandidate skips a missing bare ollama command instead of throwing", async () => {
  const originalPath = process.env.PATH;
  const emptyPath = await mkdtemp(resolve(tmpdir(), "chillclaw-local-runtime-empty-path-"));
  process.env.PATH = emptyPath;

  try {
    const runtime = await resolveInstalledRuntimeCandidate([
      {
        command: "ollama",
        source: "existing-install",
        managed: false
      }
    ]);

    assert.equal(runtime, undefined);
  } finally {
    process.env.PATH = originalPath;
  }
});

test("resolveInstalledRuntimeCandidate accepts a PATH ollama executable when present", async () => {
  const originalPath = process.env.PATH;
  const runtimeBinDir = await mkdtemp(resolve(tmpdir(), "chillclaw-local-runtime-bin-"));
  const ollamaPath = resolve(runtimeBinDir, "ollama");
  await writeFile(ollamaPath, "#!/bin/sh\necho 'ollama version 0.0.0-test'\n");
  await chmod(ollamaPath, 0o755);
  process.env.PATH = runtimeBinDir;

  try {
    const runtime = await resolveInstalledRuntimeCandidate([
      {
        command: "ollama",
        source: "existing-install",
        managed: false
      }
    ]);

    assert.deepEqual(runtime, {
      command: "ollama",
      source: "existing-install",
      managed: false
    });
  } finally {
    process.env.PATH = originalPath;
  }
});

test("resolveDiskProbePath falls back to the nearest existing parent for first-run local runtime paths", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "chillclaw-local-runtime-disk-"));
  const existingParent = resolve(root, "daemon-data");
  const missingTarget = resolve(existingParent, "ollama-runtime");
  await mkdir(existingParent, { recursive: true });

  const resolvedPath = await resolveDiskProbePath(missingTarget);

  assert.equal(resolvedPath, existingParent);
});
