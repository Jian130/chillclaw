import { performance } from "node:perf_hooks";

import type {
  CompleteOnboardingResponse,
  LocalModelRuntimeOverview,
  ModelConfigActionResponse,
  OnboardingCompletionSummary,
  OnboardingDraftState,
  OnboardingEmployeeState,
  OnboardingInstallState,
  OnboardingStateResponse,
  OnboardingStep,
  SetupRunResponse
} from "@chillclaw/contracts";

import { errorToLogDetails, writeErrorLog, writeInfoLog } from "./logger.js";

const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 300;
const MAX_ARRAY_LENGTH = 20;
const MAX_OBJECT_DEPTH = 6;

type Jsonish = null | boolean | number | string | Jsonish[] | { [key: string]: Jsonish | undefined };
type LogDetails = Record<string, Jsonish | undefined>;

function isSensitiveKey(key: string): boolean {
  return /(?:apiKey|secret|password|token|credential|authorization|authHeader|privateKey|clientSecret)/iu.test(key);
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}... [truncated ${value.length - MAX_STRING_LENGTH} chars]`;
}

export function sanitizeOnboardingLogDetails(value: unknown, depth = 0): Jsonish | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (depth >= MAX_OBJECT_DEPTH) {
    return "[Max depth reached]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((entry) => sanitizeOnboardingLogDetails(entry, depth + 1) ?? null);
  }

  const sanitized: Record<string, Jsonish> = {};
  for (const [key, entry] of Object.entries(value)) {
    sanitized[key] = isSensitiveKey(key)
      ? REDACTED
      : sanitizeOnboardingLogDetails(entry, depth + 1) ?? null;
  }

  return sanitized;
}

function summarizeInstall(install: OnboardingInstallState | undefined): LogDetails | undefined {
  if (!install) {
    return undefined;
  }

  return {
    installed: install.installed,
    version: install.version,
    disposition: install.disposition,
    updateAvailable: install.updateAvailable
  };
}

function summarizeEmployee(employee: OnboardingEmployeeState | undefined): LogDetails | undefined {
  if (!employee) {
    return undefined;
  }

  return {
    hasMemberId: Boolean(employee.memberId),
    hasName: Boolean(employee.name?.trim()),
    hasJobTitle: Boolean(employee.jobTitle?.trim()),
    avatarPresetId: employee.avatarPresetId,
    presetId: employee.presetId,
    presetSkillCount: employee.presetSkillIds?.length ?? 0,
    knowledgePackCount: employee.knowledgePackIds?.length ?? 0,
    workStyleCount: employee.workStyles?.length ?? 0,
    personalityTraitCount: employee.personalityTraits?.length ?? 0,
    memoryEnabled: employee.memoryEnabled
  };
}

export function summarizeOnboardingDraft(draft: Partial<OnboardingDraftState> | undefined): LogDetails | undefined {
  if (!draft) {
    return undefined;
  }

  return {
    currentStep: draft.currentStep,
    install: summarizeInstall(draft.install),
    permissions: draft.permissions
      ? {
          confirmed: draft.permissions.confirmed,
          hasConfirmedAt: Boolean(draft.permissions.confirmedAt)
        }
      : undefined,
    model: draft.model
      ? {
          providerId: draft.model.providerId,
          modelKey: draft.model.modelKey,
          methodId: draft.model.methodId,
          hasEntryId: Boolean(draft.model.entryId),
          entryId: draft.model.entryId
        }
      : undefined,
    channel: draft.channel
      ? {
          channelId: draft.channel.channelId,
          hasEntryId: Boolean(draft.channel.entryId),
          entryId: draft.channel.entryId
        }
      : undefined,
    channelProgress: draft.channelProgress
      ? {
          status: draft.channelProgress.status,
          hasSessionId: Boolean(draft.channelProgress.sessionId),
          requiresGatewayApply: draft.channelProgress.requiresGatewayApply
        }
      : undefined,
    activeModelAuthSessionId: draft.activeModelAuthSessionId ? "[present]" : undefined,
    activeChannelSessionId: draft.activeChannelSessionId ? "[present]" : undefined,
    employee: summarizeEmployee(draft.employee)
  };
}

function summarizeSummary(summary: OnboardingCompletionSummary | undefined): LogDetails | undefined {
  if (!summary) {
    return undefined;
  }

  return {
    install: summarizeInstall(summary.install),
    model: summary.model
      ? {
          providerId: summary.model.providerId,
          modelKey: summary.model.modelKey,
          methodId: summary.model.methodId,
          hasEntryId: Boolean(summary.model.entryId),
          entryId: summary.model.entryId
        }
      : undefined,
    channel: summary.channel
      ? {
          channelId: summary.channel.channelId,
          hasEntryId: Boolean(summary.channel.entryId),
          entryId: summary.channel.entryId
        }
      : undefined,
    employee: summarizeEmployee(summary.employee)
  };
}

export function summarizeLocalRuntime(localRuntime: LocalModelRuntimeOverview | undefined): LogDetails | undefined {
  if (!localRuntime) {
    return undefined;
  }

  return {
    supported: localRuntime.supported,
    recommendation: localRuntime.recommendation,
    supportCode: localRuntime.supportCode,
    status: localRuntime.status,
    runtimeInstalled: localRuntime.runtimeInstalled,
    runtimeReachable: localRuntime.runtimeReachable,
    modelDownloaded: localRuntime.modelDownloaded,
    activeInOpenClaw: localRuntime.activeInOpenClaw,
    recommendedTier: localRuntime.recommendedTier,
    chosenModelKey: localRuntime.chosenModelKey,
    managedEntryId: localRuntime.managedEntryId,
    downloadJobId: localRuntime.downloadJobId
  };
}

function summarizeOnboardingState(response: OnboardingStateResponse | undefined): LogDetails | undefined {
  if (!response) {
    return undefined;
  }

  return {
    firstRun: response.firstRun
      ? {
          introCompleted: response.firstRun.introCompleted,
          setupCompleted: response.firstRun.setupCompleted,
          hasSelectedProfileId: Boolean(response.firstRun.selectedProfileId)
        }
      : undefined,
    draft: summarizeOnboardingDraft(response.draft),
    summary: summarizeSummary(response.summary),
    localRuntime: summarizeLocalRuntime(response.localRuntime)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function summarizeOnboardingOperationResult(result: unknown): Jsonish | undefined {
  if (!isRecord(result)) {
    return sanitizeOnboardingLogDetails(result);
  }

  if (isRecord(result.onboarding)) {
    return {
      onboarding: summarizeOnboardingState(result.onboarding as unknown as OnboardingStateResponse)
    };
  }

  if (isRecord(result.draft) && isRecord(result.summary)) {
    return summarizeOnboardingState(result as unknown as OnboardingStateResponse);
  }

  if ((result as Partial<CompleteOnboardingResponse>).status === "completed" && isRecord(result.summary)) {
    const completed = result as Partial<CompleteOnboardingResponse>;
    return {
      status: completed.status,
      destination: completed.destination,
      summary: summarizeSummary(completed.summary),
      warmupTaskId: completed.warmupTaskId
    };
  }

  if (isRecord((result as Partial<SetupRunResponse>).install)) {
    const setup = result as Partial<SetupRunResponse>;
    return {
      status: setup.status,
      message: setup.message,
      install: sanitizeOnboardingLogDetails(setup.install),
      stepCount: setup.steps?.length,
      onboarding: summarizeOnboardingState(setup.onboarding)
    };
  }

  if (isRecord((result as Partial<ModelConfigActionResponse>).authSession)) {
    const model = result as Partial<ModelConfigActionResponse>;
    return {
      status: model.status,
      message: model.message,
      authSession: {
        id: model.authSession?.id,
        providerId: model.authSession?.providerId,
        methodId: model.authSession?.methodId,
        status: model.authSession?.status
      },
      onboarding: summarizeOnboardingState(model.onboarding)
    };
  }

  return sanitizeOnboardingLogDetails(result);
}

export function summarizeStepTransition(fromStep: OnboardingStep | undefined, toStep: OnboardingStep | undefined): LogDetails {
  return {
    fromStep,
    toStep
  };
}

export function shouldLogOnboardingInfo(): boolean {
  return process.env.CHILLCLAW_ONBOARDING_VERBOSE_LOGS === "1" || process.env.CHILLCLAW_VERBOSE_LOGS === "1";
}

export function logOnboardingEvent(scope: string, message: string, details?: unknown): void {
  if (!shouldLogOnboardingInfo()) {
    return;
  }

  void writeInfoLog(message, sanitizeOnboardingLogDetails(details), { scope });
}

export function traceOnboardingOperation<T>(
  scope: string,
  details: unknown,
  operation: () => Promise<T>,
  summarizeResult: (result: T) => unknown = summarizeOnboardingOperationResult
): Promise<T> {
  const startedAt = performance.now();
  if (shouldLogOnboardingInfo()) {
    void writeInfoLog("Onboarding operation started.", sanitizeOnboardingLogDetails(details), { scope });
  }

  return operation()
    .then((result) => {
      if (shouldLogOnboardingInfo()) {
        void writeInfoLog(
          "Onboarding operation completed.",
          sanitizeOnboardingLogDetails({
            durationMs: Number((performance.now() - startedAt).toFixed(1)),
            result: summarizeResult(result)
          }),
          { scope }
        );
      }
      return result;
    })
    .catch((error: unknown) => {
      void writeErrorLog(
        "Onboarding operation failed.",
        sanitizeOnboardingLogDetails({
          durationMs: Number((performance.now() - startedAt).toFixed(1)),
          input: details,
          error: errorToLogDetails(error)
        }),
        { scope }
      );
      throw error;
    });
}
