import { spawn } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { delimiter, dirname, join, resolve } from "node:path";

import type {
  GatewayActionResponse,
  LocalModelRuntimeAction,
  LocalModelRuntimeOverview,
  LocalModelRuntimePhase,
  LocalModelRuntimeStatus,
  ModelConfigActionResponse,
  ModelConfigOverview
} from "@chillclaw/contracts";

import { chooseLocalModelTier, type LocalModelHostSnapshot } from "../config/local-model-runtime-catalog.js";
import type { ManagedLocalModelEntryRequest } from "../engine/adapter.js";
import { getManagedOllamaAppPath, getManagedOllamaCliPath, getManagedOllamaDir, getManagedOllamaModelsDir } from "../runtime-paths.js";
import { logDevelopmentCommand } from "./logger.js";
import { StateStore } from "./state-store.js";
import type { EventPublisher } from "./event-publisher.js";
import type { EngineAdapter } from "../engine/adapter.js";

export type ResolvedOllamaRuntime = {
  command: string;
  source: "managed-install" | "existing-install";
  managed: boolean;
};

export type PersistedLocalModelRuntimeState = {
  managedEntryId?: string;
  selectedModelKey?: string;
  status?: LocalModelRuntimeStatus;
  lastError?: string;
};

export type LocalModelRuntimeResult = {
  status: "completed" | "failed";
  message: string;
  localRuntime: LocalModelRuntimeOverview;
};

export type LocalModelRuntimeAccess = {
  inspectHost: () => Promise<LocalModelHostSnapshot>;
  readPersistedState: () => Promise<PersistedLocalModelRuntimeState | undefined>;
  writePersistedState: (nextState: PersistedLocalModelRuntimeState) => Promise<void>;
  fetchModelConfig: () => Promise<ModelConfigOverview>;
  resolveInstalledRuntime: () => Promise<ResolvedOllamaRuntime | undefined>;
  installManagedRuntime: () => Promise<ResolvedOllamaRuntime>;
  isRuntimeReachable: (runtime: ResolvedOllamaRuntime | undefined) => Promise<boolean>;
  startRuntime: (runtime: ResolvedOllamaRuntime) => Promise<void>;
  isModelAvailable: (runtime: ResolvedOllamaRuntime, modelTag: string) => Promise<boolean>;
  pullModel: (runtime: ResolvedOllamaRuntime, modelTag: string, publishMessage: (message: string) => void) => Promise<void>;
  upsertManagedLocalModelEntry: (request: ManagedLocalModelEntryRequest) => Promise<ModelConfigActionResponse>;
  restartGateway: () => Promise<GatewayActionResponse>;
  publishProgress: (action: LocalModelRuntimeAction, phase: LocalModelRuntimePhase, message: string, localRuntime: LocalModelRuntimeOverview) => void;
  publishCompleted: (
    action: LocalModelRuntimeAction,
    status: "completed" | "failed",
    message: string,
    localRuntime: LocalModelRuntimeOverview
  ) => void;
};

function modelTagFromKey(modelKey: string): string {
  return modelKey.replace(/^ollama\//, "");
}

export async function resolveDiskProbePath(targetPath: string): Promise<string> {
  let candidate = targetPath;

  for (;;) {
    try {
      await stat(candidate);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      const parent = dirname(candidate);
      if (parent === candidate) {
        return candidate;
      }
      candidate = parent;
    }
  }
}

function activeLocalEntry(modelConfig: ModelConfigOverview) {
  const defaultEntry =
    modelConfig.savedEntries.find((entry) => entry.id === modelConfig.defaultEntryId) ??
    modelConfig.savedEntries.find((entry) => entry.modelKey === modelConfig.defaultModel);

  return defaultEntry?.providerId === "ollama" || defaultEntry?.modelKey.startsWith("ollama/") || modelConfig.defaultModel?.startsWith("ollama/")
    ? defaultEntry
    : undefined;
}

function inFlightStatus(status: LocalModelRuntimeStatus | undefined): status is Extract<
  LocalModelRuntimeStatus,
  "installing-runtime" | "starting-runtime" | "downloading-model" | "configuring-openclaw"
> {
  return (
    status === "installing-runtime" ||
    status === "starting-runtime" ||
    status === "downloading-model" ||
    status === "configuring-openclaw"
  );
}

function unsupportedOverview(
  host: LocalModelHostSnapshot,
  supportCode: LocalModelRuntimeOverview["supportCode"],
  detail: string
): LocalModelRuntimeOverview {
  return {
    supported: false,
    recommendation: "cloud",
    supportCode,
    status: "cloud-recommended",
    runtimeInstalled: false,
    runtimeReachable: false,
    modelDownloaded: false,
    activeInOpenClaw: false,
    totalMemoryGb: host.totalMemoryGb,
    freeDiskGb: host.freeDiskGb,
    summary: "This Mac is better suited to cloud AI.",
    detail,
    recoveryHint: "Use a cloud model provider instead."
  };
}

export class LocalModelRuntimeService {
  constructor(private readonly access: LocalModelRuntimeAccess) {}

  async decorateModelConfig(modelConfig: ModelConfigOverview): Promise<ModelConfigOverview> {
    return {
      ...modelConfig,
      localRuntime: await this.getOverview(modelConfig)
    };
  }

  async getOverview(existingModelConfig?: ModelConfigOverview): Promise<LocalModelRuntimeOverview> {
    const persisted = await this.access.readPersistedState();
    const host = await this.access.inspectHost();

    if (host.platform !== "darwin") {
      return unsupportedOverview(host, "unsupported-platform", `ChillClaw only automates local Ollama setup on macOS right now. This machine reports ${host.platform}.`);
    }

    if (host.architecture !== "arm64") {
      return unsupportedOverview(host, "unsupported-architecture", "Phase 1 local AI automation is limited to Apple Silicon Macs.");
    }

    const recommendedTier = chooseLocalModelTier(host);
    if (!recommendedTier) {
      return unsupportedOverview(
        host,
        host.totalMemoryGb < 16 ? "insufficient-memory" : "insufficient-disk",
        host.totalMemoryGb < 16
          ? "ChillClaw recommends at least 16 GB of unified memory for the starter local model."
          : "ChillClaw recommends more free disk space before downloading a starter local model."
      );
    }

    const modelConfig = existingModelConfig ?? (await this.access.fetchModelConfig());
    const runtime = await this.access.resolveInstalledRuntime();
    const activeEntry = activeLocalEntry(modelConfig);
    const chosenModelKey = persisted?.selectedModelKey ?? activeEntry?.modelKey ?? recommendedTier.modelKey;
    const runtimeReachable = runtime ? await this.access.isRuntimeReachable(runtime) : false;
    const modelDownloaded = runtime && chosenModelKey ? await this.access.isModelAvailable(runtime, modelTagFromKey(chosenModelKey)) : false;
    const activeInOpenClaw = Boolean(activeEntry || modelConfig.defaultModel?.startsWith("ollama/"));

    let status: LocalModelRuntimeStatus = "idle";
    if (inFlightStatus(persisted?.status)) {
      status = persisted?.status;
    } else if (persisted?.status === "failed") {
      status = "failed";
    } else if (activeInOpenClaw && (!runtimeReachable || !modelDownloaded)) {
      status = "degraded";
    } else if (activeInOpenClaw && runtimeReachable && modelDownloaded) {
      status = "ready";
    } else if (runtime && !runtimeReachable) {
      status = "degraded";
    }

    let summary = "Local AI is available on this Mac.";
    let detail = `ChillClaw recommends the ${recommendedTier.id} Ollama starter tier for this Apple Silicon Mac.`;

    if (status === "ready") {
      summary = "Local AI is ready on this Mac.";
      detail = "ChillClaw connected OpenClaw directly to the local Ollama runtime.";
    } else if (status === "degraded") {
      summary = "Local AI needs repair.";
      detail = activeInOpenClaw
        ? "OpenClaw is pointed at the local Ollama model, but the local runtime is unavailable or missing its model."
        : "ChillClaw found a local Ollama install, but it is not reachable yet.";
    } else if (status === "failed") {
      summary = "Local AI setup did not finish.";
      detail = persisted?.lastError ?? "ChillClaw could not finish the local Ollama setup.";
    }

    return {
      supported: true,
      recommendation: "local",
      supportCode: "supported",
      status,
      runtimeInstalled: Boolean(runtime),
      runtimeReachable,
      modelDownloaded,
      activeInOpenClaw,
      recommendedTier: recommendedTier.id,
      requiredDiskGb: recommendedTier.requiredDiskGb,
      totalMemoryGb: host.totalMemoryGb,
      freeDiskGb: host.freeDiskGb,
      chosenModelKey,
      managedEntryId: persisted?.managedEntryId ?? activeEntry?.id,
      summary,
      detail,
      lastError: persisted?.lastError,
      recoveryHint: status === "degraded" || status === "failed" ? "Repair the local Ollama runtime or switch back to a cloud model." : undefined
    };
  }

  async install(): Promise<LocalModelRuntimeResult> {
    return this.runAction("install");
  }

  async repair(): Promise<LocalModelRuntimeResult> {
    return this.runAction("repair");
  }

  private async runAction(action: LocalModelRuntimeAction): Promise<LocalModelRuntimeResult> {
    const before = await this.getOverview();
    if (!before.supported || before.recommendation === "cloud") {
      const failed = {
        ...before,
        status: "cloud-recommended" as const
      };
      await this.access.writePersistedState({
        ...(await this.access.readPersistedState()),
        status: failed.status,
        lastError: failed.detail
      });
      this.access.publishCompleted(action, "failed", failed.summary, failed);
      return {
        status: "failed",
        message: failed.summary,
        localRuntime: failed
      };
    }

    try {
      await this.setProgressState(action, "installing-runtime", "ChillClaw is checking the local Ollama runtime.");
      let runtime = await this.access.resolveInstalledRuntime();
      if (!runtime) {
        runtime = await this.access.installManagedRuntime();
      }

      if (!(await this.access.isRuntimeReachable(runtime))) {
        await this.setProgressState(action, "starting-runtime", "ChillClaw is starting the local Ollama runtime.");
        await this.access.startRuntime(runtime);
      }

      const persisted = await this.access.readPersistedState();
      const targetModelKey = persisted?.selectedModelKey ?? before.chosenModelKey ?? "ollama/gemma4:e2b";
      const targetModelTag = modelTagFromKey(targetModelKey);

      if (!(await this.access.isModelAvailable(runtime, targetModelTag))) {
        await this.setProgressState(action, "downloading-model", "ChillClaw is downloading the starter local model.");
        await this.access.pullModel(runtime, targetModelTag, asyncMessage => {
          void this.publishProgressSnapshot(action, "downloading-model", asyncMessage);
        });
      }

      await this.setProgressState(action, "configuring-openclaw", "ChillClaw is connecting OpenClaw to the local Ollama runtime.");
      const mutation = await this.access.upsertManagedLocalModelEntry({
        label: "Local AI on this Mac",
        providerId: "ollama",
        methodId: "ollama-local",
        modelKey: targetModelKey,
        entryId: persisted?.managedEntryId
      });

      await this.access.restartGateway();

      const managedEntry =
        mutation.modelConfig.savedEntries.find((entry) => entry.id === mutation.modelConfig.defaultEntryId) ??
        mutation.modelConfig.savedEntries.find((entry) => entry.modelKey === targetModelKey);
      await this.access.writePersistedState({
        managedEntryId: managedEntry?.id ?? persisted?.managedEntryId,
        selectedModelKey: targetModelKey,
        status: "ready"
      });
      const localRuntime = await this.getOverview(mutation.modelConfig);
      const message = "Local AI is ready on this Mac.";
      this.access.publishCompleted(action, "completed", message, localRuntime);

      return {
        status: "completed",
        message,
        localRuntime
      };
    } catch (error) {
      await this.access.writePersistedState({
        ...(await this.access.readPersistedState()),
        status: "failed",
        lastError: error instanceof Error ? error.message : String(error)
      });
      const localRuntime = await this.getOverview();
      const message = error instanceof Error ? error.message : "ChillClaw could not finish local AI setup.";
      this.access.publishCompleted(action, "failed", message, localRuntime);
      return {
        status: "failed",
        message,
        localRuntime
      };
    }
  }

  private async setProgressState(action: LocalModelRuntimeAction, status: Extract<
    LocalModelRuntimeStatus,
    "installing-runtime" | "starting-runtime" | "downloading-model" | "configuring-openclaw"
  >, message: string): Promise<void> {
    const persisted = await this.access.readPersistedState();
    await this.access.writePersistedState({
      ...persisted,
      status,
      lastError: undefined
    });
    await this.publishProgressSnapshot(action, progressPhaseForStatus(status), message);
  }

  private async publishProgressSnapshot(action: LocalModelRuntimeAction, phase: LocalModelRuntimePhase, message: string): Promise<void> {
    this.access.publishProgress(action, phase, message, await this.getOverview());
  }
}

function progressPhaseForStatus(status: Extract<
  LocalModelRuntimeStatus,
  "installing-runtime" | "starting-runtime" | "downloading-model" | "configuring-openclaw"
>): LocalModelRuntimePhase {
  switch (status) {
    case "installing-runtime":
      return "installing-runtime";
    case "starting-runtime":
      return "starting-runtime";
    case "downloading-model":
      return "downloading-model";
    case "configuring-openclaw":
    default:
      return "configuring-openclaw";
  }
}

export async function commandExists(path: string, pathValue = process.env.PATH): Promise<boolean> {
  if (!path.includes("/")) {
    for (const directory of pathValue?.split(delimiter) ?? []) {
      if (!directory) {
        continue;
      }

      if (await commandExists(join(directory, path))) {
        return true;
      }
    }

    return false;
  }

  try {
    const file = await stat(path);
    return file.isFile() && (file.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export async function resolveInstalledRuntimeCandidate(
  candidates: ResolvedOllamaRuntime[]
): Promise<ResolvedOllamaRuntime | undefined> {
  for (const candidate of candidates) {
    if (!(await commandExists(candidate.command))) {
      continue;
    }

    const result = await runLoggedCommand("localModelRuntime.resolveInstalledRuntime", candidate.command, ["--version"], {
      allowFailure: true
    });
    if (result.code === 0) {
      return candidate;
    }
  }

  return undefined;
}

function ollamaEnvironment(runtime: ResolvedOllamaRuntime): Record<string, string | undefined> {
  if (!runtime.managed) {
    return {};
  }

  return {
    OLLAMA_MODELS: getManagedOllamaModelsDir(),
    OLLAMA_HOST: "127.0.0.1:11434"
  };
}

async function runLoggedCommand(
  scope: string,
  command: string,
  args: string[],
  options?: { envOverrides?: Record<string, string | undefined>; allowFailure?: boolean }
): Promise<{ code: number; stdout: string; stderr: string }> {
  logDevelopmentCommand(scope, command, args);

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        ...(options?.envOverrides ?? {})
      }
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      const result = {
        code: code ?? 1,
        stdout,
        stderr
      };
      if (!options?.allowFailure && result.code !== 0) {
        rejectPromise(new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed.`));
        return;
      }

      resolvePromise(result);
    });
  });
}

async function runLoggedStreamingCommand(
  scope: string,
  command: string,
  args: string[],
  publishMessage: (message: string) => void,
  options?: { envOverrides?: Record<string, string | undefined> }
): Promise<void> {
  logDevelopmentCommand(scope, command, args);

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        ...(options?.envOverrides ?? {})
      }
    });
    let combinedError = "";

    const handleChunk = (chunk: Buffer) => {
      const lines = chunk
        .toString()
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const line of lines) {
        publishMessage(line);
      }
    };

    child.stdout.on("data", handleChunk);
    child.stderr.on("data", (chunk) => {
      combinedError += chunk.toString();
      handleChunk(chunk);
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if ((code ?? 1) !== 0) {
        rejectPromise(new Error(combinedError.trim() || `${command} ${args.join(" ")} failed.`));
        return;
      }

      resolvePromise();
    });
  });
}

async function waitForRuntime(command: ResolvedOllamaRuntime): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: AbortSignal.timeout(2_000)
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the deadline.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error(`ChillClaw could not reach the local Ollama runtime at ${command.command}.`);
}

export function createLocalModelRuntimeService(
  adapter: EngineAdapter,
  store: StateStore,
  eventPublisher?: EventPublisher
): LocalModelRuntimeService {
  return new LocalModelRuntimeService({
    inspectHost: async () => {
      const { statfs } = await import("node:fs/promises");
      const { totalmem } = await import("node:os");
      const stats = await statfs(await resolveDiskProbePath(getManagedOllamaDir()));
      return {
        platform: process.platform,
        architecture: process.arch,
        totalMemoryGb: Number((totalmem() / 1024 / 1024 / 1024).toFixed(1)),
        freeDiskGb: Number(((stats.bavail * stats.bsize) / 1024 / 1024 / 1024).toFixed(1))
      };
    },
    readPersistedState: async () => (await store.read()).localModelRuntime,
    writePersistedState: async (nextState) => {
      await store.update((current) => ({
        ...current,
        localModelRuntime: nextState
      }));
    },
    fetchModelConfig: async () => adapter.config.getModelConfig(),
    resolveInstalledRuntime: async () => {
      return resolveInstalledRuntimeCandidate([
        { command: getManagedOllamaCliPath(), source: "managed-install" as const, managed: true },
        { command: resolve("/Applications/Ollama.app/Contents/Resources/ollama"), source: "existing-install" as const, managed: false },
        { command: resolve(homedir(), "Applications/Ollama.app/Contents/Resources/ollama"), source: "existing-install" as const, managed: false },
        { command: "ollama", source: "existing-install" as const, managed: false }
      ]);
    },
    installManagedRuntime: async () => {
      const workspace = await mkdtemp(resolve(tmpdir(), "chillclaw-ollama-"));
      const dmgPath = resolve(workspace, "Ollama.dmg");
      const mountPath = resolve(workspace, "mount");
      await mkdir(mountPath, { recursive: true });
      await mkdir(getManagedOllamaDir(), { recursive: true });

      try {
        await runLoggedCommand("localModelRuntime.installManagedRuntime", "curl", [
          "-L",
          "https://ollama.com/download/Ollama.dmg",
          "-o",
          dmgPath
        ]);
        await runLoggedCommand("localModelRuntime.installManagedRuntime", "hdiutil", [
          "attach",
          dmgPath,
          "-nobrowse",
          "-readonly",
          "-mountpoint",
          mountPath
        ]);

        try {
          await rm(getManagedOllamaAppPath(), { recursive: true, force: true });
          await runLoggedCommand("localModelRuntime.installManagedRuntime", "ditto", [
            resolve(mountPath, "Ollama.app"),
            getManagedOllamaAppPath()
          ]);
        } finally {
          await runLoggedCommand("localModelRuntime.installManagedRuntime", "hdiutil", [
            "detach",
            mountPath
          ], {
            allowFailure: true
          });
        }

        await mkdir(getManagedOllamaModelsDir(), { recursive: true });
        return {
          command: getManagedOllamaCliPath(),
          source: "managed-install" as const,
          managed: true
        };
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    },
    isRuntimeReachable: async () => {
      try {
        const response = await fetch("http://127.0.0.1:11434/api/tags", {
          signal: AbortSignal.timeout(2_000)
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    startRuntime: async (runtime) => {
      logDevelopmentCommand("localModelRuntime.startRuntime", runtime.command, ["serve"]);
      const child = spawn(runtime.command, ["serve"], {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          ...ollamaEnvironment(runtime)
        }
      });
      child.unref();
      await waitForRuntime(runtime);
    },
    isModelAvailable: async (runtime, modelTag) => {
      const result = await runLoggedCommand("localModelRuntime.isModelAvailable", runtime.command, ["show", modelTag], {
        envOverrides: ollamaEnvironment(runtime),
        allowFailure: true
      });
      return result.code === 0;
    },
    pullModel: async (runtime, modelTag, publishMessage) => {
      await runLoggedStreamingCommand(
        "localModelRuntime.pullModel",
        runtime.command,
        ["pull", modelTag],
        publishMessage,
        {
          envOverrides: ollamaEnvironment(runtime)
        }
      );
    },
    upsertManagedLocalModelEntry: async (request) => adapter.config.upsertManagedLocalModelEntry(request),
    restartGateway: async () => adapter.gateway.restartGateway(),
    publishProgress: (action, phase, message, localRuntime) => {
      eventPublisher?.publishLocalRuntimeProgress({
        action,
        phase,
        message,
        localRuntime
      });
    },
    publishCompleted: (action, status, message, localRuntime) => {
      eventPublisher?.publishLocalRuntimeCompleted({
        action,
        status,
        message,
        localRuntime
      });
    }
  });
}
