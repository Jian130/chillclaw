import type { RuntimeAction } from "@chillclaw/contracts";

import { jsonResponse } from "./http.js";
import { createPathMatcher } from "./matchers.js";
import type { ServerContext } from "./server-context.js";
import type { RouteDefinition } from "./types.js";

const matchRuntimeAction = createPathMatcher("/api/runtime/resources/:resourceId/:action");

async function runRuntimeAction(context: ServerContext, resourceId: string, action: RuntimeAction) {
  switch (action) {
    case "prepare":
      return context.runtimeManager.prepare(resourceId);
    case "repair":
      return context.runtimeManager.repair(resourceId);
    case "check-update":
      return context.runtimeManager.checkUpdate(resourceId);
    case "stage-update":
      return context.runtimeManager.stageUpdate(resourceId);
    case "apply-update":
      return context.runtimeManager.applyUpdate(resourceId);
    case "rollback":
      return context.runtimeManager.rollback(resourceId);
    case "remove":
      return context.runtimeManager.remove(resourceId);
    default:
      throw new Error(`Unsupported runtime action ${action}.`);
  }
}

export const runtimeRoutes: RouteDefinition[] = [
  {
    method: "GET",
    match: createPathMatcher("/api/runtime/resources"),
    snapshotPolicy: "silent",
    async handle({ context }) {
      return jsonResponse(await context.runtimeManager.getOverview());
    }
  },
  {
    method: "POST",
    match: matchRuntimeAction,
    async handle({ context, params }) {
      const action = params.action as RuntimeAction;
      const result = await runRuntimeAction(context, params.resourceId, action);
      const overview = await context.overviewService.getOverview();
      context.eventPublisher.publishOverviewUpdated(overview);

      return jsonResponse({
        ...result,
        overview
      });
    }
  }
];
