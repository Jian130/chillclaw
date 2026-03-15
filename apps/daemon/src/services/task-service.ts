import type { EngineTaskRequest, EngineTaskResult } from "@slackclaw/contracts";

import type { EngineAdapter } from "../engine/adapter.js";
import { StateStore } from "./state-store.js";

export class TaskService {
  constructor(
    private readonly adapter: EngineAdapter,
    private readonly store: StateStore
  ) {}

  async runTask(request: EngineTaskRequest): Promise<EngineTaskResult> {
    const state = await this.store.read();
    const member = request.memberId ? state.aiTeam?.members?.[request.memberId] : undefined;
    const result = await this.adapter.runTask({
      ...request,
      memberAgentId: member?.agentId
    });

    await this.store.update((current) => ({
      ...current,
      tasks: [...current.tasks, result].slice(-20)
    }));

    return result;
  }
}
