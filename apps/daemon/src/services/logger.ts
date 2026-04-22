import { resolve } from "node:path";

import { FilesystemStateAdapter } from "../platform/filesystem-state-adapter.js";
import { getAppRootDir, getLogDir } from "../runtime-paths.js";

const ERROR_LOG_PATH = resolve(getLogDir(), "error.log");
const filesystem = new FilesystemStateAdapter();
const DEFAULT_COMPONENT = "ChillClaw daemon";

export type LogMetadata = {
  component?: string;
  scope?: string;
};

const MAX_COMMUNICATION_STRING_LENGTH = 200;
const SENSITIVE_KEY_PATTERN = /(?:authorization|api[-_]?key|secret|password|token|credential|sessionInput|qr|cookie)/iu;

function timestampPrefix(): string {
  return new Date().toISOString();
}

function formatScope(scope?: string): string {
  return scope ? `[${scope}]` : "";
}

function formatMessage(level: "INFO" | "ERROR", message: string, details?: unknown, metadata?: LogMetadata): string {
  const payload =
    details === undefined
      ? ""
      : ` ${typeof details === "string" ? details : JSON.stringify(details, null, 2)}`;

  return `${timestampPrefix()} [${level}]${formatScope(metadata?.scope)} ${message}${payload}\n`;
}

export function formatConsoleLine(message: string, metadata?: LogMetadata): string {
  return `${timestampPrefix()} [${metadata?.component ?? DEFAULT_COMPONENT}]${formatScope(metadata?.scope)} ${message}`;
}

export async function writeErrorLog(message: string, details?: unknown, metadata?: LogMetadata): Promise<void> {
  try {
    await filesystem.appendLog(ERROR_LOG_PATH, formatMessage("ERROR", message, details, metadata));
  } catch {
    // Logging must never crash the app.
  }
}

export async function writeInfoLog(message: string, details?: unknown, metadata?: LogMetadata): Promise<void> {
  try {
    await filesystem.appendLog(ERROR_LOG_PATH, formatMessage("INFO", message, details, metadata));
  } catch {
    // Logging must never crash the app.
  }
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function truncateCommunicationString(value: string): string {
  if (value.length <= MAX_COMMUNICATION_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_COMMUNICATION_STRING_LENGTH)}…`;
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value, "http://127.0.0.1");
    let changed = false;
    for (const key of [...url.searchParams.keys()]) {
      if (isSensitiveKey(key)) {
        url.searchParams.set(key, "[REDACTED]");
        changed = true;
      }
    }

    const rendered = value.startsWith("http://") || value.startsWith("https://")
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
    return truncateCommunicationString(changed ? rendered : value);
  } catch {
    return truncateCommunicationString(value);
  }
}

export function sanitizeCommunicationDetails(details: unknown): unknown {
  if (details === null || details === undefined) {
    return details;
  }

  if (typeof details === "string") {
    return truncateCommunicationString(details);
  }

  if (typeof details !== "object") {
    return details;
  }

  if (Array.isArray(details)) {
    return details.map((entry) => sanitizeCommunicationDetails(entry));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if ((key === "url" || key === "path") && typeof value === "string") {
      sanitized[key] = sanitizeUrl(value);
      continue;
    }

    sanitized[key] = sanitizeCommunicationDetails(value);
  }

  return sanitized;
}

export function writeCommunicationLog(message: string, details?: unknown, metadata?: LogMetadata): void {
  const scope = metadata?.scope?.startsWith("communication.")
    ? metadata.scope
    : metadata?.scope ? `communication.${metadata.scope}` : "communication";
  void writeInfoLog(message, sanitizeCommunicationDetails(details), {
    ...metadata,
    scope
  });
}

export function shouldLogDevelopmentCommands(): boolean {
  if (process.env.CHILLCLAW_LOG_DEV_COMMANDS === "0") {
    return false;
  }

  return process.env.CHILLCLAW_LOG_DEV_COMMANDS === "1" || !getAppRootDir();
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isSensitiveCommandFlag(flag: string): boolean {
  const normalized = flag.trim().toLowerCase();
  if (normalized === "-w") {
    return true;
  }

  return /^--(?:[a-z0-9-]*api-key|[a-z0-9-]*secret|[a-z0-9-]*password|gateway-token|token)$/u.test(normalized);
}

function redactSensitiveCommandArgs(args: string[]): string[] {
  const redactedArgs: string[] = [];
  let expectingSensitiveValue = false;

  for (const arg of args) {
    if (expectingSensitiveValue) {
      redactedArgs.push("[REDACTED]");
      expectingSensitiveValue = false;
      continue;
    }

    const equalsIndex = arg.indexOf("=");
    if (equalsIndex > 0) {
      const flag = arg.slice(0, equalsIndex);
      if (isSensitiveCommandFlag(flag)) {
        redactedArgs.push(`${flag}=[REDACTED]`);
        continue;
      }
    }

    redactedArgs.push(arg);
    expectingSensitiveValue = isSensitiveCommandFlag(arg);
  }

  return redactedArgs;
}

export function logDevelopmentCommand(scope: string, command: string, args: string[] = []): void {
  if (!shouldLogDevelopmentCommands()) {
    return;
  }

  const renderedArgs = redactSensitiveCommandArgs(args).map((arg) => shellQuote(arg)).join(" ");
  console.log(
    formatConsoleLine(`${command}${args.length > 0 ? ` ${renderedArgs}` : ""}`, {
      component: DEFAULT_COMPONENT,
      scope
    })
  );
}

export function errorToLogDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    value: String(error)
  };
}
