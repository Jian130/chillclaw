import type {
  ChannelSessionInputRequest,
  CompleteOnboardingRequest,
  InstallRequest,
  ModelAuthSessionInputRequest,
  OnboardingEmployeeState,
  OnboardingStepNavigationRequest,
  SaveChannelEntryRequest,
  SaveModelEntryRequest
} from "@chillclaw/contracts";

import { performance } from "node:perf_hooks";

import { jsonResponse, readJson } from "./http.js";
import { createPathMatcher } from "./matchers.js";
import { formatConsoleLine } from "../services/logger.js";
import {
  summarizeOnboardingDraft,
  summarizeOnboardingOperationResult,
  traceOnboardingOperation
} from "../services/onboarding-logger.js";
import type { RouteDefinition } from "./types.js";

const matchOnboardingModelAuthSession = createPathMatcher("/api/onboarding/model/auth/session/:sessionId");
const matchOnboardingModelAuthSessionInput = createPathMatcher("/api/onboarding/model/auth/session/:sessionId/input");
const matchOnboardingChannelEntry = createPathMatcher("/api/onboarding/channel/entries/:entryId");
const matchOnboardingChannelSession = createPathMatcher("/api/onboarding/channel/session/:sessionId");
const matchOnboardingChannelSessionInput = createPathMatcher("/api/onboarding/channel/session/:sessionId/input");

function traceOnboardingRoute<T>(
  route: string,
  details: unknown,
  action: () => Promise<T>
): Promise<T> {
  return traceOnboardingOperation(`route.${route}`, details, action, summarizeOnboardingOperationResult);
}

export const onboardingRoutes: RouteDefinition[] = [
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/intro"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/intro", {}, () => context.setupService.markIntroCompleted()));
    }
  },
  {
    method: "GET",
    match: createPathMatcher("/api/onboarding/state"),
    async handle({ context }) {
      const t0 = performance.now();
      const result = await traceOnboardingRoute("GET /api/onboarding/state", {}, () => context.onboardingService.getState());
      console.log(formatConsoleLine(`GET /api/onboarding/state: ${(performance.now() - t0).toFixed(1)}ms`, { scope: "route" }));
      return jsonResponse(result);
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/navigate"),
    async handle({ context, request }) {
      const body = await readJson<OnboardingStepNavigationRequest>(request);
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/navigate", { step: body.step }, () => context.onboardingService.navigateStep(body)));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/runtime/detect"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/runtime/detect", {}, () => context.onboardingService.detectRuntime()));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/runtime/install"),
    async handle({ context, request }) {
      const body = await readJson<InstallRequest>(request);
      return jsonResponse(await traceOnboardingRoute(
        "POST /api/onboarding/runtime/install",
        { forceLocal: body.forceLocal ?? true },
        () => context.onboardingService.installRuntime({ forceLocal: body.forceLocal ?? true })
      ));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/runtime/reuse"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/runtime/reuse", {}, () => context.onboardingService.reuseDetectedRuntime()));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/runtime/update"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/runtime/update", {}, () => context.onboardingService.updateRuntime()));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/permissions/confirm"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/permissions/confirm", {}, () => context.onboardingService.confirmPermissions()));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/model/entries"),
    async handle({ context, request }) {
      const body = await readJson<SaveModelEntryRequest>(request);
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/model/entries", {
        providerId: body.providerId,
        methodId: body.methodId,
        modelKey: body.modelKey,
        makeDefault: body.makeDefault,
        useAsFallback: body.useAsFallback,
        valueKeys: Object.keys(body.values ?? {})
      }, () => context.onboardingService.saveModelEntry(body)));
    }
  },
  {
    method: "GET",
    match: matchOnboardingModelAuthSession,
    async handle({ context, params }) {
      return jsonResponse(await traceOnboardingRoute(
        "GET /api/onboarding/model/auth/session/:sessionId",
        { sessionId: params.sessionId },
        () => context.onboardingService.getModelAuthSession(params.sessionId)
      ));
    }
  },
  {
    method: "POST",
    match: matchOnboardingModelAuthSessionInput,
    async handle({ context, request, params }) {
      const body = await readJson<ModelAuthSessionInputRequest>(request);
      return jsonResponse(await traceOnboardingRoute(
        "POST /api/onboarding/model/auth/session/:sessionId/input",
        { sessionId: params.sessionId, hasValue: Boolean(body.value?.trim()) },
        () => context.onboardingService.submitModelAuthSessionInput(params.sessionId, body)
      ));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/channel/entries"),
    async handle({ context, request }) {
      const body = await readJson<SaveChannelEntryRequest>(request);
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/channel/entries", {
        channelId: body.channelId,
        action: body.action,
        valueKeys: Object.keys(body.values ?? {})
      }, () => context.onboardingService.saveChannelEntry(undefined, body)));
    }
  },
  {
    method: "PATCH",
    match: matchOnboardingChannelEntry,
    async handle({ context, request, params }) {
      const body = await readJson<SaveChannelEntryRequest>(request);
      return jsonResponse(await traceOnboardingRoute("PATCH /api/onboarding/channel/entries/:entryId", {
        entryId: params.entryId,
        channelId: body.channelId,
        action: body.action,
        valueKeys: Object.keys(body.values ?? {})
      }, () => context.onboardingService.saveChannelEntry(params.entryId, body)));
    }
  },
  {
    method: "GET",
    match: matchOnboardingChannelSession,
    async handle({ context, params }) {
      return jsonResponse(await traceOnboardingRoute(
        "GET /api/onboarding/channel/session/:sessionId",
        { sessionId: params.sessionId },
        () => context.onboardingService.getChannelSession(params.sessionId)
      ));
    }
  },
  {
    method: "POST",
    match: matchOnboardingChannelSessionInput,
    async handle({ context, request, params }) {
      const body = await readJson<ChannelSessionInputRequest>(request);
      return jsonResponse(await traceOnboardingRoute(
        "POST /api/onboarding/channel/session/:sessionId/input",
        { sessionId: params.sessionId, hasValue: Boolean(body.value?.trim()) },
        () => context.onboardingService.submitChannelSessionInput(params.sessionId, body)
      ));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/employee"),
    async handle({ context, request }) {
      const body = await readJson<OnboardingEmployeeState>(request);
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/employee", {
        employee: summarizeOnboardingDraft({ currentStep: "employee", employee: body })?.employee
      }, () => context.onboardingService.saveEmployeeDraft(body)));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/model/reset"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/model/reset", {}, () => context.onboardingService.resetModelDraft()));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/channel/reset"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/channel/reset", {}, () => context.onboardingService.resetChannelDraft()));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/reset"),
    async handle({ context }) {
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/reset", {}, () => context.onboardingService.reset()));
    }
  },
  {
    method: "POST",
    match: createPathMatcher("/api/onboarding/complete"),
    async handle({ context, request }) {
      const body = await readJson<CompleteOnboardingRequest>(request);
      return jsonResponse(await traceOnboardingRoute("POST /api/onboarding/complete", {
        destination: body.destination,
        employee: body.employee ? summarizeOnboardingDraft({ currentStep: "employee", employee: body.employee })?.employee : undefined
      }, () => context.onboardingService.complete(body)));
    }
  }
];
