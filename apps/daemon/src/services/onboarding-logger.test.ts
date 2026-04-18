import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeOnboardingLogDetails,
  shouldLogOnboardingInfo,
  summarizeOnboardingDraft,
  summarizeOnboardingOperationResult
} from "./onboarding-logger.js";

test("onboarding log sanitizer redacts nested secrets without hiding model keys", () => {
  const sanitized = sanitizeOnboardingLogDetails({
    providerId: "minimax",
    modelKey: "minimax/MiniMax-M2.7",
    values: {
      apiKey: "live-api-key",
      appSecret: "live-secret",
      nested: {
        accessToken: "live-token",
        normal: "visible"
      }
    }
  });

  assert.deepEqual(sanitized, {
    providerId: "minimax",
    modelKey: "minimax/MiniMax-M2.7",
    values: {
      apiKey: "[REDACTED]",
      appSecret: "[REDACTED]",
      nested: {
        accessToken: "[REDACTED]",
        normal: "visible"
      }
    }
  });
});

test("onboarding draft summaries avoid user-entered profile text", () => {
  const summary = summarizeOnboardingDraft({
    currentStep: "employee",
    install: {
      installed: true,
      version: "2026.3.11",
      disposition: "installed-managed"
    },
    model: {
      providerId: "ollama",
      modelKey: "ollama/gemma4:e2b",
      entryId: "runtime:ollama-gemma4-e2b"
    },
    channel: {
      channelId: "wechat",
      entryId: "wechat:default"
    },
    channelProgress: {
      status: "staged",
      message: "Saved"
    },
    employee: {
      name: "Private Name",
      jobTitle: "Private Role",
      avatarPresetId: "onboarding-analyst",
      presetSkillIds: ["research-brief"]
    }
  });

  assert.ok(summary && typeof summary === "object" && !Array.isArray(summary));
  assert.deepEqual(summary.employee, {
    hasMemberId: false,
    hasName: true,
    hasJobTitle: true,
    avatarPresetId: "onboarding-analyst",
    presetId: undefined,
    presetSkillCount: 1,
    knowledgePackCount: 0,
    workStyleCount: 0,
    personalityTraitCount: 0,
    memoryEnabled: undefined
  });
  assert.equal(JSON.stringify(summary).includes("Private Name"), false);
  assert.equal(JSON.stringify(summary).includes("Private Role"), false);
});

test("onboarding operation result summaries include route-relevant state", () => {
  const summary = summarizeOnboardingOperationResult({
    onboarding: {
      draft: {
        currentStep: "model",
        install: {
          installed: true,
          disposition: "installed-managed"
        }
      },
      summary: {
        install: {
          installed: true,
          disposition: "installed-managed"
        }
      },
      localRuntime: {
        supported: true,
        recommendation: "local",
        status: "idle",
        runtimeInstalled: false,
        runtimeReachable: false,
        modelDownloaded: false,
        activeInOpenClaw: false,
        recommendedTier: "small",
        chosenModelKey: "ollama/gemma4:e2b"
      }
    }
  });

  assert.deepEqual(summary, {
    onboarding: {
      firstRun: undefined,
      draft: {
        currentStep: "model",
        install: {
          installed: true,
          version: undefined,
          disposition: "installed-managed",
          updateAvailable: undefined
        },
        permissions: undefined,
        model: undefined,
        channel: undefined,
        channelProgress: undefined,
        activeModelAuthSessionId: undefined,
        activeChannelSessionId: undefined,
        employee: undefined
      },
      summary: {
        install: {
          installed: true,
          version: undefined,
          disposition: "installed-managed",
          updateAvailable: undefined
        },
        model: undefined,
        channel: undefined,
        employee: undefined
      },
      localRuntime: {
        supported: true,
        recommendation: "local",
        supportCode: undefined,
        status: "idle",
        runtimeInstalled: false,
        runtimeReachable: false,
        modelDownloaded: false,
        activeInOpenClaw: false,
        recommendedTier: "small",
        chosenModelKey: "ollama/gemma4:e2b",
        managedEntryId: undefined,
        downloadJobId: undefined
      }
    }
  });
});

test("onboarding info logs stay quiet unless verbose onboarding logging is enabled", () => {
  const originalOnboardingVerbose = process.env.CHILLCLAW_ONBOARDING_VERBOSE_LOGS;
  const originalGlobalVerbose = process.env.CHILLCLAW_VERBOSE_LOGS;

  try {
    delete process.env.CHILLCLAW_ONBOARDING_VERBOSE_LOGS;
    delete process.env.CHILLCLAW_VERBOSE_LOGS;
    assert.equal(shouldLogOnboardingInfo(), false);

    process.env.CHILLCLAW_ONBOARDING_VERBOSE_LOGS = "1";
    assert.equal(shouldLogOnboardingInfo(), true);

    delete process.env.CHILLCLAW_ONBOARDING_VERBOSE_LOGS;
    process.env.CHILLCLAW_VERBOSE_LOGS = "1";
    assert.equal(shouldLogOnboardingInfo(), true);
  } finally {
    if (originalOnboardingVerbose === undefined) {
      delete process.env.CHILLCLAW_ONBOARDING_VERBOSE_LOGS;
    } else {
      process.env.CHILLCLAW_ONBOARDING_VERBOSE_LOGS = originalOnboardingVerbose;
    }

    if (originalGlobalVerbose === undefined) {
      delete process.env.CHILLCLAW_VERBOSE_LOGS;
    } else {
      process.env.CHILLCLAW_VERBOSE_LOGS = originalGlobalVerbose;
    }
  }
});
