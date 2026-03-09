import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, dirname, resolve } from "node:path";

import type {
  ChannelSetupState,
  EngineCapabilities,
  EngineInstallSpec,
  EngineStatus,
  EngineTaskRequest,
  EngineTaskResult,
  HealthCheckResult,
  InstallResponse,
  PairingApprovalRequest,
  RecoveryAction,
  RecoveryRunResponse,
  TelegramSetupRequest,
  WechatSetupRequest
} from "@slackclaw/contracts";

import type { EngineAdapter } from "./adapter.js";
import { getAppRootDir, getDataDir, getManagedOpenClawBinPath, getManagedOpenClawDir } from "../runtime-paths.js";
import { errorToLogDetails, writeErrorLog, writeInfoLog } from "../services/logger.js";

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface OpenClawStatusJson {
  setup?: {
    required?: boolean;
  };
  gateway?: {
    reachable?: boolean;
    error?: string | null;
  };
  gatewayService?: {
    installed?: boolean;
    loadedText?: string;
    runtimeShort?: string;
  };
  channelSummary?: string[];
  providers?: {
    summary?: {
      missingProfiles?: number;
      error?: string | null;
    };
    missing?: string[];
  };
  securityAudit?: {
    summary?: {
      critical?: number;
      warn?: number;
      info?: number;
    };
    findings?: Array<{
      checkId?: string;
      severity?: string;
      title?: string;
      detail?: string;
      remediation?: string;
    }>;
  };
  agents?: {
    defaultId?: string;
    bootstrapPendingCount?: number;
  };
}

type SecurityFinding = NonNullable<NonNullable<OpenClawStatusJson["securityAudit"]>["findings"]>[number];

interface OpenClawGatewayStatusJson {
  service?: {
    installed?: boolean;
    loaded?: boolean;
    loadedText?: string;
    runtime?: {
      status?: string;
      detail?: string;
    };
    configAudit?: {
      ok?: boolean;
      issues?: Array<{
        code?: string;
        message?: string;
        detail?: string;
        level?: string;
      }>;
    };
  };
  rpc?: {
    ok?: boolean;
    error?: string;
    url?: string;
  };
}

interface OpenClawUpdateStatusJson {
  update?: {
    root?: string;
    installKind?: string;
    packageManager?: string;
    registry?: {
      latestVersion?: string | null;
      error?: string | null;
    };
  };
  channel?: {
    label?: string;
  };
  availability?: {
    available?: boolean;
    latestVersion?: string | null;
  };
}

interface OpenClawAgentJson {
  ok?: boolean;
  output?: string;
  finalText?: string;
  response?: string;
  message?: string;
}

interface OpenClawAdapterState {
  configuredProfileId?: string;
  installedAt?: string;
  lastInstallMode?: "detected" | "onboarded";
}

const OPENCLAW_STATE_PATH = resolve(getDataDir(), "openclaw-state.json");
const OPENCLAW_VERSION_PIN = "2026.3.7";

interface BootstrapResult {
  status: "reused-existing" | "would-install" | "would-reinstall" | "installed" | "reinstalled" | "failed";
  changed: boolean;
  hadExisting: boolean;
  existingVersion?: string;
  version?: string | null;
  message: string;
}

interface CommandInvocation {
  command: string;
  argsPrefix: string[];
  display: string;
}

interface LoginSessionState {
  startedAt: string;
  status: "in-progress" | "awaiting-pairing" | "completed" | "failed";
  logs: string[];
  exitCode?: number;
}

let whatsappLoginSession: LoginSessionState | undefined;

function buildCommandEnv(command?: string): NodeJS.ProcessEnv {
  const pathEntries = [
    command && command.startsWith("/") ? dirname(command) : undefined,
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
    ...(process.env.PATH ? process.env.PATH.split(delimiter) : [])
  ].filter((value): value is string => Boolean(value));

  return {
    ...process.env,
    PATH: [...new Set(pathEntries)].join(delimiter),
    NO_COLOR: "1"
  };
}

function toInstallDisposition(
  bootstrapStatus: BootstrapResult["status"],
  mode: "detected" | "onboarded"
): InstallResponse["disposition"] {
  if (mode === "onboarded") {
    return "onboarded";
  }

  if (bootstrapStatus === "reused-existing" || bootstrapStatus === "installed" || bootstrapStatus === "reinstalled") {
    return bootstrapStatus;
  }

  return "installed";
}

function createChannelState(
  id: "telegram" | "whatsapp" | "wechat",
  overrides: Partial<ChannelSetupState>
): ChannelSetupState {
  const defaults: Record<string, ChannelSetupState> = {
    telegram: {
      id: "telegram",
      title: "Telegram",
      officialSupport: true,
      status: "not-started",
      summary: "Telegram setup has not started yet.",
      detail: "Add a bot token, then approve the first pairing request."
    },
    whatsapp: {
      id: "whatsapp",
      title: "WhatsApp",
      officialSupport: true,
      status: "not-started",
      summary: "WhatsApp setup has not started yet.",
      detail: "Start the login flow, scan the QR, then approve the pairing request."
    },
    wechat: {
      id: "wechat",
      title: "WeChat workaround",
      officialSupport: false,
      status: "not-started",
      summary: "WeChat requires an experimental workaround plugin.",
      detail: "Install the plugin workaround, configure the app credentials, then restart the gateway."
    }
  };

  return {
    ...defaults[id],
    ...overrides,
    lastUpdatedAt: overrides.lastUpdatedAt ?? new Date().toISOString()
  };
}

async function runOpenClaw(args: string[], options?: { allowFailure?: boolean }): Promise<CommandResult> {
  const command = await resolveOpenClawCommand();

  if (!command) {
    if (options?.allowFailure) {
      return {
        code: 1,
        stdout: "",
        stderr: "OpenClaw CLI is not installed."
      };
    }

    throw new Error("OpenClaw CLI is not installed.");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: buildCommandEnv(command)
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      void writeErrorLog("Failed to spawn OpenClaw command.", {
        command,
        args,
        error: errorToLogDetails(error)
      });
      reject(error);
    });

    child.on("exit", (code) => {
      const result: CommandResult = {
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };

      if (!options?.allowFailure && result.code !== 0) {
        reject(new Error(result.stderr || result.stdout || `openclaw ${args.join(" ")} failed`));
        return;
      }

      resolve(result);
    });
  });
}

async function runCommand(command: string, args: string[], options?: { allowFailure?: boolean }): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: buildCommandEnv(command)
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      void writeErrorLog("Failed to spawn system command for SlackClaw.", {
        command,
        args,
        error: errorToLogDetails(error)
      });
      reject(error);
    });

    child.on("exit", (code) => {
      const result: CommandResult = {
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };

      if (!options?.allowFailure && result.code !== 0) {
        reject(new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed`));
        return;
      }

      resolve(result);
    });
  });
}

async function fileExists(pathname: string): Promise<boolean> {
  try {
    await access(pathname, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommandFromPath(command: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-lc", `command -v ${command}`], {
      stdio: ["ignore", "pipe", "ignore"],
      env: buildCommandEnv()
    });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("exit", (code) => {
      const resolved = stdout.trim();
      resolve(code === 0 && resolved.startsWith("/") ? resolved : undefined);
    });

    child.on("error", () => resolve(undefined));
  });
}

async function resolveCommand(command: string, extraCandidates: string[] = []): Promise<string | undefined> {
  const fromPath = await resolveCommandFromPath(command);

  if (fromPath) {
    return fromPath;
  }

  for (const candidate of extraCandidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function probeCommand(command: string, args: string[] = ["--version"]): Promise<boolean> {
  try {
    const result = await runCommand(command, args, { allowFailure: true });
    return result.code === 0;
  } catch {
    return false;
  }
}

async function resolveOpenClawCommand(): Promise<string | undefined> {
  const managedBinary = getManagedOpenClawBinPath();

  if ((await fileExists(managedBinary)) && (await probeCommand(managedBinary))) {
    return managedBinary;
  }

  const systemBinary = await resolveCommand("openclaw", ["/opt/homebrew/bin/openclaw", "/usr/local/bin/openclaw"]);

  if (systemBinary && (await probeCommand(systemBinary))) {
    return systemBinary;
  }

  return undefined;
}

async function resolveNodeCommand(): Promise<string | undefined> {
  const nodeCommand = await resolveCommand("node", [
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node",
    "/usr/bin/node",
    resolve(process.env.HOME ?? "", ".nvm/current/bin/node")
  ]);

  if (nodeCommand && (await probeCommand(nodeCommand))) {
    return nodeCommand;
  }

  return undefined;
}

async function probeInvocation(invocation: CommandInvocation, args: string[] = ["--version"]): Promise<boolean> {
  try {
    const result = await runCommand(invocation.command, [...invocation.argsPrefix, ...args], { allowFailure: true });
    return result.code === 0;
  } catch {
    return false;
  }
}

async function resolveNpmInvocation(): Promise<CommandInvocation | undefined> {
  const npmCommand = await resolveCommand("npm", [
    "/opt/homebrew/bin/npm",
    "/usr/local/bin/npm",
    "/usr/bin/npm",
    resolve(process.env.HOME ?? "", ".nvm/current/bin/npm")
  ]);

  if (npmCommand) {
    const npmInvocation: CommandInvocation = {
      command: npmCommand,
      argsPrefix: [],
      display: npmCommand
    };

    if (await probeInvocation(npmInvocation)) {
      return npmInvocation;
    }
  }

  const nodeCommand = await resolveNodeCommand();

  if (!nodeCommand) {
    return undefined;
  }

  const npmCliCandidates = [
    process.env.npm_execpath,
    "/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js",
    "/usr/local/lib/node_modules/npm/bin/npm-cli.js"
  ].filter((value): value is string => Boolean(value));

  for (const candidate of npmCliCandidates) {
    if (!(await fileExists(candidate))) {
      continue;
    }

    const cliInvocation: CommandInvocation = {
      command: nodeCommand,
      argsPrefix: [candidate],
      display: `${nodeCommand} ${candidate}`
    };

    if (await probeInvocation(cliInvocation)) {
      return cliInvocation;
    }
  }

  return undefined;
}

async function resolveGitCommand(): Promise<string | undefined> {
  const gitCommand = await resolveCommand("git", ["/opt/homebrew/bin/git", "/usr/local/bin/git", "/usr/bin/git"]);

  if (gitCommand && (await probeCommand(gitCommand))) {
    return gitCommand;
  }

  return undefined;
}

async function resolveBrewCommand(): Promise<string | undefined> {
  const brewCommand = await resolveCommand("brew", ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]);

  if (brewCommand && (await probeCommand(brewCommand, ["--version"]))) {
    return brewCommand;
  }

  return undefined;
}

async function readInstalledOpenClawVersion(): Promise<string | undefined> {
  const result = await runOpenClaw(["--version"], { allowFailure: true }).catch(() => ({
    code: 1,
    stdout: "",
    stderr: ""
  }));

  if (result.code !== 0 || !result.stdout) {
    return undefined;
  }

  return result.stdout;
}

async function readVersionFromCommand(command: string | undefined): Promise<string | undefined> {
  if (!command) {
    return undefined;
  }

  const result = await runCommand(command, ["--version"], { allowFailure: true }).catch(() => ({
    code: 1,
    stdout: "",
    stderr: ""
  }));

  if (result.code !== 0 || !result.stdout) {
    return undefined;
  }

  return result.stdout;
}

async function readManagedOpenClawVersion(): Promise<string | undefined> {
  const managedBinary = getManagedOpenClawBinPath();

  if (!(await fileExists(managedBinary)) || !(await probeCommand(managedBinary))) {
    return undefined;
  }

  return readVersionFromCommand(managedBinary);
}

async function readSystemOpenClawVersion(): Promise<string | undefined> {
  const systemCommand = await resolveCommand("openclaw", ["/opt/homebrew/bin/openclaw", "/usr/local/bin/openclaw"]);

  if (!systemCommand || !(await probeCommand(systemCommand))) {
    return undefined;
  }

  return readVersionFromCommand(systemCommand);
}

function safeJsonParse<T>(value: string | undefined): T | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function summarizeGateway(gatewayStatus?: OpenClawGatewayStatusJson): string | undefined {
  if (!gatewayStatus) {
    return undefined;
  }

  if (gatewayStatus.rpc?.ok) {
    return "Gateway is reachable.";
  }

  if (gatewayStatus.service?.installed && gatewayStatus.service.loaded === false) {
    return "Gateway service is installed but not loaded.";
  }

  if (gatewayStatus.rpc?.error) {
    return gatewayStatus.rpc.error;
  }

  return undefined;
}

async function readAdapterState(): Promise<OpenClawAdapterState> {
  try {
    const raw = await readFile(OPENCLAW_STATE_PATH, "utf8");
    return JSON.parse(raw) as OpenClawAdapterState;
  } catch {
    return {};
  }
}

async function writeAdapterState(nextState: OpenClawAdapterState): Promise<void> {
  await mkdir(getDataDir(), { recursive: true });
  await writeFile(OPENCLAW_STATE_PATH, JSON.stringify(nextState, null, 2));
}

function createTaskTitle(request: EngineTaskRequest): string {
  if (request.templateId) {
    return `Run ${request.templateId}`;
  }

  return request.prompt.length > 36 ? `${request.prompt.slice(0, 36)}...` : request.prompt;
}

export class OpenClawAdapter implements EngineAdapter {
  readonly installSpec: EngineInstallSpec = {
    engine: "openclaw",
    desiredVersion: OPENCLAW_VERSION_PIN,
    installSource: "npm-local",
    prerequisites: [
      "macOS 14 or newer",
      "Either npm already available on the Mac, or Homebrew available so SlackClaw can install Node/npm and Git",
      "Permission to install or reuse the pinned OpenClaw CLI"
    ],
    installPath: getManagedOpenClawDir()
  };

  readonly capabilities: EngineCapabilities = {
    engine: "openclaw",
    supportsInstall: true,
    supportsUpdate: true,
    supportsRecovery: true,
    supportsStreaming: false,
    runtimeModes: ["gateway", "embedded", "local-llm"],
    supportedChannels: ["local-ui"],
    starterSkillCategories: ["communication", "research", "docs", "operations"],
    futureLocalModelFamilies: ["qwen", "minimax", "llama", "mistral", "custom-openai-compatible"]
  };

  async install(autoConfigure: boolean, options?: { forceLocal?: boolean }): Promise<InstallResponse> {
    const bootstrap = await this.ensurePinnedOpenClaw(options?.forceLocal ?? false);
    const state = await readAdapterState();
    const mode: "detected" | "onboarded" = "detected";
    let message = `${bootstrap.message} SlackClaw is ready to run OpenClaw onboarding next.`;

    if (autoConfigure && !state.configuredProfileId) {
      await this.configure("email-admin");
    }

    await writeAdapterState({
      ...state,
      installedAt: new Date().toISOString(),
      lastInstallMode: mode
    });

    const engineStatus = await this.status();

    return {
      status: "installed",
      message,
      engineStatus,
      disposition: toInstallDisposition(bootstrap.status, mode),
      changed: bootstrap.changed,
      hadExisting: bootstrap.hadExisting,
      pinnedVersion: OPENCLAW_VERSION_PIN,
      existingVersion: bootstrap.existingVersion,
      actualVersion: bootstrap.version ?? undefined
    };
  }

  async onboard(profileId: string): Promise<void> {
    const statusBefore = await this.collectStatusData();

    if (statusBefore.setupRequired || !statusBefore.cliVersion) {
      const result = await runOpenClaw(
        [
          "onboard",
          "--non-interactive",
          "--accept-risk",
          "--flow",
          "quickstart",
          "--mode",
          "local",
          "--skip-channels",
          "--skip-search",
          "--skip-skills",
          "--skip-ui",
          "--install-daemon",
          "--json"
        ],
        { allowFailure: true }
      );

      if (result.code !== 0) {
        throw new Error(result.stderr || result.stdout || "OpenClaw onboarding failed.");
      }
    }

    await this.configure(profileId);
  }

  async configure(profileId: string): Promise<void> {
    const state = await readAdapterState();

    if (await resolveOpenClawCommand()) {
      await runOpenClaw(["config", "set", "slackclaw.defaultProfile", profileId], { allowFailure: true });
    }

    await writeAdapterState({
      ...state,
      configuredProfileId: profileId
    });
  }

  async status(): Promise<EngineStatus> {
    const data = await this.collectStatusData();

    return {
      engine: "openclaw",
      installed: data.installed,
      running: data.gatewayReachable,
      version: data.cliVersion,
      summary: data.summary,
      lastCheckedAt: new Date().toISOString()
    };
  }

  async healthCheck(selectedProfileId?: string): Promise<HealthCheckResult[]> {
    const data = await this.collectStatusData();
    const state = await readAdapterState();
    const effectiveProfile = selectedProfileId ?? state.configuredProfileId;
    const checks: HealthCheckResult[] = [];

    checks.push({
      id: "engine-cli",
      title: "OpenClaw CLI",
      severity: data.installed ? "ok" : "error",
      summary: data.installed ? `OpenClaw ${data.cliVersion ?? "detected"} is installed.` : "OpenClaw CLI is missing.",
      detail: data.installed
        ? "SlackClaw can invoke the upstream CLI."
        : "Install OpenClaw before SlackClaw can perform onboarding or tasks.",
      remediationActionIds: data.installed ? [] : ["reinstall-engine"]
    });

    checks.push({
      id: "gateway-service",
      title: "Gateway service",
      severity: data.gatewayReachable ? "ok" : data.gatewayInstalled ? "warning" : "error",
      summary: data.gatewayReachable
        ? "Gateway is reachable."
        : data.gatewayInstalled
          ? "Gateway service is installed but not reachable."
          : "Gateway service is not installed.",
      detail: data.gatewayDetail,
      remediationActionIds: data.gatewayReachable
        ? []
        : data.gatewayInstalled
          ? ["restart-engine", "reinstall-engine"]
          : ["reinstall-engine"]
    });

    checks.push({
      id: "version-compatibility",
      title: "Version compatibility",
      severity: data.cliVersion === OPENCLAW_VERSION_PIN ? "ok" : data.cliVersion ? "warning" : "info",
      summary: data.cliVersion
        ? data.cliVersion === OPENCLAW_VERSION_PIN
          ? "OpenClaw matches SlackClaw's pinned version."
          : `OpenClaw ${data.cliVersion} differs from SlackClaw's pinned ${OPENCLAW_VERSION_PIN}.`
        : "OpenClaw version is unknown.",
      detail: "SlackClaw currently targets a pinned-compatible OpenClaw release for reliability.",
      remediationActionIds: data.cliVersion === OPENCLAW_VERSION_PIN ? [] : ["rollback-update"]
    });

    checks.push({
      id: "default-profile",
      title: "SlackClaw defaults",
      severity: effectiveProfile ? "ok" : "info",
      summary: effectiveProfile ? `Default profile set to ${effectiveProfile}.` : "No SlackClaw onboarding profile selected yet.",
      detail: effectiveProfile
        ? "SlackClaw can apply office-work defaults to new tasks."
        : "Complete onboarding so SlackClaw can choose a beginner-friendly default workflow.",
      remediationActionIds: effectiveProfile ? [] : ["repair-config"]
    });

    if (data.providersMissingCount > 0) {
      checks.push({
        id: "provider-auth",
        title: "Provider authentication",
        severity: "warning",
        summary: `${data.providersMissingCount} model provider profile(s) are missing auth.`,
        detail: data.providersMissingDetail,
        remediationActionIds: ["repair-config", "export-diagnostics"]
      });
    }

    for (const finding of data.securityFindings.slice(0, 3)) {
      checks.push({
        id: finding.checkId ?? `security-${randomUUID()}`,
        title: finding.title ?? "Security audit finding",
        severity: finding.severity === "critical" ? "error" : finding.severity === "warn" ? "warning" : "info",
        summary: finding.title ?? "Security audit reported an issue.",
        detail: [finding.detail, finding.remediation].filter(Boolean).join(" "),
        remediationActionIds: ["export-diagnostics"]
      });
    }

    return checks;
  }

  async runTask(request: EngineTaskRequest): Promise<EngineTaskResult> {
    const startedAt = new Date().toISOString();
    const state = await readAdapterState();
    const installed = Boolean(await resolveOpenClawCommand());
    const title = createTaskTitle(request);

    if (!installed) {
      return {
        taskId: randomUUID(),
        title,
        status: "failed",
        summary: "OpenClaw is not installed.",
        output: "Install OpenClaw before running tasks.",
        nextActions: ["Install OpenClaw", "Use the mock adapter for UI development"],
        startedAt,
        finishedAt: new Date().toISOString(),
        steps: [
          { id: "prepare", label: "Preparing task", status: "done" },
          { id: "execute", label: "Running engine task", status: "done" }
        ]
      };
    }

    const result = await runOpenClaw(
      [
        "agent",
        "--local",
        "--json",
        ...(await this.resolveAgentArgs()),
        "--message",
        request.prompt
      ],
      { allowFailure: true }
    );

    const parsed = safeJsonParse<OpenClawAgentJson>(result.stdout);
    const output =
      parsed?.output ??
      parsed?.finalText ??
      parsed?.response ??
      parsed?.message ??
      result.stdout ??
      result.stderr;
    const ok = result.code === 0 && Boolean(output);

    return {
      taskId: randomUUID(),
      title,
      status: ok ? "completed" : "failed",
      summary: ok
        ? `OpenClaw completed the task using profile ${request.profileId}.`
        : "OpenClaw did not return a successful local agent response.",
      output: ok
        ? output
        : [
            "OpenClaw task execution failed.",
            result.stderr || result.stdout || "No output was returned.",
            state.configuredProfileId
              ? `SlackClaw default profile: ${state.configuredProfileId}`
              : "SlackClaw onboarding profile is not configured yet."
          ].join("\n\n"),
      nextActions: ok
        ? ["Refine the prompt", "Save as a reusable workflow", "Export the result"]
        : ["Repair setup defaults", "Restart engine", "Export diagnostics"],
      startedAt,
      finishedAt: new Date().toISOString(),
      steps: [
        { id: "prepare", label: "Preparing task", status: "done" },
        { id: "execute", label: "Running openclaw agent --local", status: "done" },
        { id: "summarize", label: "Formatting response", status: "done" }
      ]
    };
  }

  async update(): Promise<{ message: string; engineStatus: EngineStatus }> {
    const updateResult = await runOpenClaw(["update", "status", "--json"], { allowFailure: true });
    const parsed = safeJsonParse<OpenClawUpdateStatusJson>(updateResult.stdout);
    const engineStatus = await this.status();

    if (parsed?.availability?.available) {
      return {
        message: `OpenClaw update available: ${parsed.availability.latestVersion ?? "new version detected"} on ${parsed.channel?.label ?? "current channel"}.`,
        engineStatus
      };
    }

    if (parsed?.update?.registry?.error) {
      return {
        message: `SlackClaw checked for updates, but registry lookup failed: ${parsed.update.registry.error}.`,
        engineStatus
      };
    }

    return {
      message: "SlackClaw verified that no newer pinned-compatible OpenClaw version is currently visible.",
      engineStatus
    };
  }

  async repair(action: RecoveryAction): Promise<RecoveryRunResponse> {
    if (!(await resolveOpenClawCommand())) {
      return {
        actionId: action.id,
        status: "failed",
        message: "OpenClaw CLI is not installed."
      };
    }

    switch (action.id) {
      case "restart-engine": {
        const restart = await runOpenClaw(["gateway", "restart"], { allowFailure: true });
        return {
          actionId: action.id,
          status: restart.code === 0 ? "completed" : "failed",
          message: restart.code === 0
            ? "OpenClaw gateway restart completed."
            : restart.stderr || restart.stdout || "OpenClaw gateway restart failed."
        };
      }
      case "repair-config": {
        await this.configure("email-admin");
        const doctor = await runOpenClaw(["doctor", "--repair", "--non-interactive", "--yes"], { allowFailure: true });
        return {
          actionId: action.id,
          status: doctor.code === 0 ? "completed" : "failed",
          message: doctor.code === 0
            ? "SlackClaw defaults were restored and OpenClaw doctor applied safe repairs."
            : doctor.stderr || doctor.stdout || "OpenClaw doctor could not complete repairs."
        };
      }
      case "rollback-update": {
        const updateStatus = await runOpenClaw(["update", "status", "--json"], { allowFailure: true });
        const parsed = safeJsonParse<OpenClawUpdateStatusJson>(updateStatus.stdout);
        return {
          actionId: action.id,
          status: "completed",
          message: parsed?.availability?.available
            ? `SlackClaw detected update drift. Manual rollback to ${OPENCLAW_VERSION_PIN} is recommended until automated rollback is added.`
            : `SlackClaw remains pinned to ${OPENCLAW_VERSION_PIN}; no rollback was needed.`
        };
      }
      case "reinstall-engine": {
        const bootstrap = await this.ensurePinnedOpenClaw(false);
        const reinstall = await runOpenClaw(["gateway", "install", "--force"], { allowFailure: true });
        const installStatus = bootstrap.status !== "failed" && reinstall.code === 0 ? "completed" : "failed";
        return {
          actionId: action.id,
          status: installStatus,
          message: installStatus === "completed"
            ? `${bootstrap.message} OpenClaw gateway service was reinstalled.`
            : bootstrap.status === "failed"
              ? bootstrap.message
              : reinstall.stderr || reinstall.stdout || "OpenClaw gateway reinstall failed."
        };
      }
      case "export-diagnostics":
        return {
          actionId: action.id,
          status: "completed",
          message: "Diagnostics are ready for export."
        };
      default:
        return {
          actionId: action.id,
          status: "failed",
          message: "Unsupported recovery action."
        };
    }
  }

  async exportDiagnostics(): Promise<{ filename: string; content: string }> {
    const [status, health, gateway, update] = await Promise.all([
      this.status(),
      this.healthCheck(),
      runOpenClaw(["gateway", "status", "--json"], { allowFailure: true }),
      runOpenClaw(["update", "status", "--json"], { allowFailure: true })
    ]);

    return {
      filename: "slackclaw-diagnostics.json",
      content: JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          installSpec: this.installSpec,
          status,
          health,
          raw: {
            gatewayStatus: safeJsonParse<OpenClawGatewayStatusJson>(gateway.stdout) ?? gateway.stderr,
            updateStatus: safeJsonParse<OpenClawUpdateStatusJson>(update.stdout) ?? update.stderr
          }
        },
        null,
        2
      )
    };
  }

  async getChannelState(channelId: "telegram" | "whatsapp" | "wechat"): Promise<ChannelSetupState> {
    if (channelId === "whatsapp" && whatsappLoginSession) {
      return createChannelState("whatsapp", {
        status: whatsappLoginSession.status,
        summary:
          whatsappLoginSession.status === "failed"
            ? "WhatsApp login session failed."
            : whatsappLoginSession.status === "completed"
              ? "WhatsApp login session completed."
              : whatsappLoginSession.status === "awaiting-pairing"
                ? "WhatsApp login is waiting for pairing approval."
                : "WhatsApp login is running.",
        detail:
          whatsappLoginSession.logs.at(-1) ??
          "Scan the QR code or follow the WhatsApp login instructions shown by OpenClaw.",
        logs: whatsappLoginSession.logs.slice(-20)
      });
    }

    return createChannelState(channelId, {});
  }

  async configureTelegram(request: TelegramSetupRequest): Promise<{ message: string; channel: ChannelSetupState }> {
    const args = ["channels", "add", "--channel", "telegram", "--token", request.token];

    if (request.accountName?.trim()) {
      args.push("--name", request.accountName.trim());
    }

    const result = await runOpenClaw(args, { allowFailure: true });

    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "SlackClaw could not save the Telegram channel configuration.");
    }

    return {
      message: "Telegram bot token saved. Send a message to the bot, then approve the pairing code in SlackClaw.",
      channel: createChannelState("telegram", {
        status: "awaiting-pairing",
        summary: "Telegram token saved.",
        detail: "The Telegram bot is configured. Send the first message to your bot, then approve the pairing code."
      })
    };
  }

  async startWhatsappLogin(): Promise<{ message: string; channel: ChannelSetupState }> {
    if (whatsappLoginSession?.status === "in-progress") {
      return {
        message: "WhatsApp login is already running.",
        channel: await this.getChannelState("whatsapp")
      };
    }

    await runOpenClaw(["channels", "add", "--channel", "whatsapp", "--name", "SlackClaw WhatsApp"], {
      allowFailure: true
    });

    whatsappLoginSession = {
      startedAt: new Date().toISOString(),
      status: "in-progress",
      logs: ["Starting WhatsApp login. OpenClaw may print a QR code or pairing instructions here."]
    };

    const command = await resolveOpenClawCommand();

    if (!command) {
      throw new Error("OpenClaw CLI is not installed.");
    }

    const child = spawn(command, ["channels", "login", "--channel", "whatsapp", "--verbose"], {
      env: buildCommandEnv(command)
    });

    const pushLog = (text: string) => {
      if (!whatsappLoginSession) {
        return;
      }

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean);
      whatsappLoginSession.logs.push(...lines);
      whatsappLoginSession.logs = whatsappLoginSession.logs.slice(-40);
      whatsappLoginSession.status = "awaiting-pairing";
    };

    child.stdout.on("data", (chunk) => {
      pushLog(chunk.toString());
    });

    child.stderr.on("data", (chunk) => {
      pushLog(chunk.toString());
    });

    child.on("error", (error) => {
      if (!whatsappLoginSession) {
        return;
      }

      whatsappLoginSession.status = "failed";
      whatsappLoginSession.logs.push(`Failed to start WhatsApp login: ${error instanceof Error ? error.message : String(error)}`);
      void writeErrorLog("WhatsApp login session failed to start.", errorToLogDetails(error));
    });

    child.on("exit", (code) => {
      if (!whatsappLoginSession) {
        return;
      }

      whatsappLoginSession.exitCode = code ?? 1;
      whatsappLoginSession.status = code === 0 ? "awaiting-pairing" : "failed";
      whatsappLoginSession.logs.push(
        code === 0
          ? "WhatsApp login command finished. If pairing is pending, approve the code below."
          : `WhatsApp login command exited with code ${code ?? 1}.`
      );
    });

    return {
      message: "SlackClaw started the WhatsApp login flow. Follow the QR or pairing instructions shown in the session log.",
      channel: await this.getChannelState("whatsapp")
    };
  }

  async approvePairing(
    channelId: "telegram" | "whatsapp",
    request: PairingApprovalRequest
  ): Promise<{ message: string; channel: ChannelSetupState }> {
    const result = await runOpenClaw(["pairing", "approve", channelId, request.code, "--notify"], { allowFailure: true });

    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || `SlackClaw could not approve the ${channelId} pairing code.`);
    }

    if (channelId === "whatsapp" && whatsappLoginSession) {
      whatsappLoginSession.status = "completed";
      whatsappLoginSession.logs.push("WhatsApp pairing approved.");
    }

    return {
      message: `${channelId === "telegram" ? "Telegram" : "WhatsApp"} pairing approved.`,
      channel: createChannelState(channelId, {
        status: "completed",
        summary: `${channelId === "telegram" ? "Telegram" : "WhatsApp"} pairing approved.`,
        detail: "This channel is ready for use."
      })
    };
  }

  async configureWechatWorkaround(
    request: WechatSetupRequest
  ): Promise<{ message: string; channel: ChannelSetupState }> {
    const pluginSpec = request.pluginSpec?.trim() || "@openclaw-china/wecom-app";
    const pluginId = pluginSpec.split("/").pop() ?? pluginSpec;
    const install = await runOpenClaw(["plugins", "install", pluginSpec], { allowFailure: true });

    if (install.code !== 0) {
      throw new Error(install.stderr || install.stdout || `SlackClaw could not install the WeChat workaround plugin ${pluginSpec}.`);
    }

    const enableById = await runOpenClaw(["plugins", "enable", pluginId], { allowFailure: true });

    if (enableById.code !== 0) {
      await runOpenClaw(["plugins", "enable", pluginSpec], { allowFailure: true });
    }
    await runOpenClaw(["config", "set", "--strict-json", `channels.${pluginId}`, JSON.stringify({
      enabled: true,
      webhookPath: `/${pluginId}`,
      token: request.token,
      encodingAESKey: request.encodingAesKey,
      corpId: request.corpId,
      corpSecret: request.secret,
      agentId: Number(request.agentId),
      dmPolicy: "pairing",
      groupPolicy: "open"
    })], { allowFailure: true });

    return {
      message: `SlackClaw installed the experimental ${pluginSpec} workaround and saved the WeChat enterprise app configuration.`,
      channel: createChannelState("wechat", {
        status: "completed",
        summary: "WeChat workaround configured.",
        detail: "Restart the gateway to load the WeChat workaround plugin."
      })
    };
  }

  async startGatewayAfterChannels(): Promise<{ message: string; engineStatus: EngineStatus }> {
    const restart = await runOpenClaw(["gateway", "restart"], { allowFailure: true });
    const engineStatus = await this.status();

    if (restart.code !== 0 || !engineStatus.running) {
      throw new Error(restart.stderr || restart.stdout || "SlackClaw could not restart the OpenClaw gateway after channel setup.");
    }

    return {
      message: "OpenClaw gateway restarted and is reachable.",
      engineStatus
    };
  }

  private async collectStatusData(): Promise<{
    installed: boolean;
    cliVersion?: string;
    gatewayReachable: boolean;
    gatewayInstalled: boolean;
    gatewayDetail: string;
    providersMissingCount: number;
    providersMissingDetail: string;
    setupRequired: boolean;
    summary: string;
    securityFindings: SecurityFinding[];
  }> {
    const installed = Boolean(await resolveOpenClawCommand());

    if (!installed) {
      return {
        installed: false,
        cliVersion: undefined,
        gatewayReachable: false,
        gatewayInstalled: false,
        gatewayDetail: "OpenClaw CLI is missing.",
        providersMissingCount: 0,
        providersMissingDetail: "No provider status available.",
        setupRequired: true,
        summary: "OpenClaw is not installed.",
        securityFindings: []
      };
    }

    const [versionResult, statusResult, gatewayResult] = await Promise.all([
      runOpenClaw(["--version"], { allowFailure: true }),
      runOpenClaw(["status", "--json"], { allowFailure: true }),
      runOpenClaw(["gateway", "status", "--json"], { allowFailure: true })
    ]);

    const cliVersion = versionResult.stdout || undefined;
    const statusJson = safeJsonParse<OpenClawStatusJson>(statusResult.stdout);
    const gatewayJson = safeJsonParse<OpenClawGatewayStatusJson>(gatewayResult.stdout);

    const gatewayReachable = Boolean(statusJson?.gateway?.reachable || gatewayJson?.rpc?.ok);
    const gatewayInstalled = Boolean(statusJson?.gatewayService?.installed || gatewayJson?.service?.installed);
    const setupRequired = Boolean(statusJson?.setup?.required);
    const providersMissingCount =
      statusJson?.providers?.summary?.missingProfiles ??
      statusJson?.providers?.missing?.length ??
      0;
    const providersMissingDetail =
      statusJson?.providers?.summary?.error ??
      (statusJson?.providers?.missing?.length
        ? `Missing provider profiles: ${statusJson.providers.missing.join(", ")}`
        : "Provider auth looks configured.");

    const gatewayDetail =
      summarizeGateway(gatewayJson) ??
      statusJson?.gateway?.error ??
      "SlackClaw could not determine gateway reachability.";

    const versionSummary =
      cliVersion === OPENCLAW_VERSION_PIN
        ? `OpenClaw ${cliVersion} matches SlackClaw's pinned version.`
        : cliVersion
          ? `OpenClaw ${cliVersion} detected. SlackClaw targets ${OPENCLAW_VERSION_PIN}.`
          : "OpenClaw version could not be determined.";

    const summary = installed
      ? gatewayReachable
        ? `OpenClaw is installed and the local gateway is reachable. ${versionSummary}`
        : `OpenClaw is installed, but the local gateway is not reachable. ${versionSummary}`
      : "OpenClaw is not installed.";

    return {
      installed,
      cliVersion,
      gatewayReachable,
      gatewayInstalled,
      gatewayDetail,
      providersMissingCount,
      providersMissingDetail,
      setupRequired,
      summary,
      securityFindings: statusJson?.securityAudit?.findings ?? []
    };
  }

  private async ensurePinnedOpenClaw(forceLocal: boolean): Promise<BootstrapResult> {
    const existingVersion = forceLocal ? await readManagedOpenClawVersion() : await readInstalledOpenClawVersion();
    const systemVersion = forceLocal ? await readSystemOpenClawVersion() : existingVersion;
    const installPath = getManagedOpenClawDir();
    const usesManagedLocalRuntime = forceLocal || Boolean(getAppRootDir());
    const brewCommand = await resolveBrewCommand();

    if (existingVersion === OPENCLAW_VERSION_PIN) {
      return {
        status: "reused-existing",
        changed: false,
        hadExisting: true,
        existingVersion,
        version: existingVersion,
        message: usesManagedLocalRuntime
          ? `OpenClaw ${existingVersion} is already available in SlackClaw's managed local runtime.`
          : `OpenClaw ${existingVersion} is already installed and matches the pinned version.`
      };
    }

    const npmInvocation = await resolveNpmInvocation();
    const ensuredNpmInvocation = npmInvocation ?? (await this.ensureSystemDependencies());

    if (!ensuredNpmInvocation) {
      throw new Error(
        brewCommand
          ? "SlackClaw asked Homebrew to prepare the required toolchain, but still could not find a working npm executable afterward."
          : existingVersion || systemVersion
            ? `SlackClaw found OpenClaw ${existingVersion ?? systemVersion}, but cannot deploy a managed local copy because neither npm nor Homebrew is available on this Mac.`
            : "SlackClaw cannot deploy OpenClaw locally because neither npm nor Homebrew is available on this Mac."
      );
    }

    if (usesManagedLocalRuntime) {
      await mkdir(installPath, { recursive: true });
    }

    const installArgs = usesManagedLocalRuntime
      ? ["install", "--prefix", installPath, `openclaw@${OPENCLAW_VERSION_PIN}`]
      : ["install", "--global", `openclaw@${OPENCLAW_VERSION_PIN}`];

    const installResult = await runCommand(
      ensuredNpmInvocation.command,
      [...ensuredNpmInvocation.argsPrefix, ...installArgs],
      { allowFailure: true }
    );

    if (installResult.code !== 0) {
      await writeErrorLog("OpenClaw install command failed.", {
        command: ensuredNpmInvocation.display,
        args: installArgs,
        result: installResult
      });
      throw new Error(installResult.stderr || installResult.stdout || "OpenClaw installation failed.");
    }

    const nextVersion = await readInstalledOpenClawVersion();

    if (nextVersion !== OPENCLAW_VERSION_PIN) {
      throw new Error(
        usesManagedLocalRuntime
          ? `SlackClaw downloaded OpenClaw into ${installPath}, but could not verify that the managed runtime can execute on this Mac.`
          : "SlackClaw installed OpenClaw, but could not verify the installed CLI."
      );
    }

    return {
      status: existingVersion || systemVersion ? "reinstalled" : "installed",
      changed: true,
      hadExisting: Boolean(existingVersion || systemVersion),
      existingVersion: existingVersion ?? systemVersion,
      version: nextVersion,
      message: usesManagedLocalRuntime
        ? existingVersion
          ? `SlackClaw refreshed its managed local OpenClaw ${nextVersion} runtime in ${installPath}.`
          : systemVersion
            ? `SlackClaw deployed a managed local OpenClaw ${nextVersion} runtime into ${installPath} instead of depending on the system OpenClaw ${systemVersion}.`
            : `SlackClaw deployed OpenClaw ${nextVersion} locally into ${installPath}.`
        : existingVersion
          ? `Replaced existing OpenClaw ${existingVersion} with ${nextVersion}.`
          : `Installed OpenClaw ${nextVersion}.`
    };
  }

  private async resolveAgentArgs(): Promise<string[]> {
    const statusResult = await runOpenClaw(["status", "--json"], { allowFailure: true });
    const statusJson = safeJsonParse<OpenClawStatusJson>(statusResult.stdout);
    const defaultAgentId = statusJson?.agents?.defaultId;

    return defaultAgentId ? ["--agent", defaultAgentId] : [];
  }

  private async ensureSystemDependencies(): Promise<CommandInvocation | undefined> {
    const [nodeCommand, npmInvocation, gitCommand, brewCommand] = await Promise.all([
      resolveNodeCommand(),
      resolveNpmInvocation(),
      resolveGitCommand(),
      resolveBrewCommand()
    ]);

    const packages: string[] = [];

    if (!nodeCommand || !npmInvocation) {
      packages.push("node");
    }

    if (!gitCommand) {
      packages.push("git");
    }

    if (packages.length === 0) {
      return npmInvocation;
    }

    if (!brewCommand) {
      await writeErrorLog("SlackClaw could not install missing dependencies because Homebrew is unavailable.", {
        missingPackages: packages
      });
      return undefined;
    }

    const installResult = await runCommand(brewCommand, ["install", ...packages], { allowFailure: true });

    if (installResult.code !== 0) {
      await writeErrorLog("SlackClaw failed to install missing dependencies with Homebrew.", {
        command: brewCommand,
        args: ["install", ...packages],
        result: installResult
      });
      throw new Error(
        installResult.stderr ||
          installResult.stdout ||
          `SlackClaw could not install missing dependencies (${packages.join(", ")}) with Homebrew.`
      );
    }

    await writeInfoLog("SlackClaw installed missing system dependencies with Homebrew.", {
      command: brewCommand,
      packages
    });

    return resolveNpmInvocation();
  }
}
