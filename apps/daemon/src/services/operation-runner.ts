import type {
  OperationCommandResponse,
  OperationScope,
  OperationSummary
} from "@chillclaw/contracts";

import { EventPublisher } from "./event-publisher.js";
import { OperationStore } from "./operation-store.js";

export interface OperationRunnerOptions {
  now?: () => string;
}

export interface StartOperationRequest {
  operationId: string;
  scope: OperationScope;
  resourceId?: string;
  action: string;
  phase?: string;
  percent?: number;
  message: string;
  result?: OperationSummary["result"];
}

export interface OperationWorkerContext {
  operation: OperationSummary;
  update: (patch: Partial<OperationSummary>) => Promise<OperationSummary>;
}

export type OperationWorker = (context: OperationWorkerContext) => Promise<Partial<OperationSummary> | void>;

const ACTIVE_OPERATION_STATUSES = new Set<OperationSummary["status"]>(["pending", "running", "timed-out"]);

function defaultNow(): string {
  return new Date().toISOString();
}

function failureMessage(operation: OperationSummary): string {
  const base = operation.message.trim().replace(/[.。]+$/, "");
  return `${base || "Operation"} failed.`;
}

export class OperationRunner {
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly now: () => string;

  constructor(
    private readonly operations: OperationStore,
    private readonly publisher: EventPublisher,
    options?: OperationRunnerOptions
  ) {
    this.now = options?.now ?? defaultNow;
  }

  async startOrResume(request: StartOperationRequest, worker: OperationWorker): Promise<OperationCommandResponse> {
    const existing = await this.operations.read(request.operationId);

    if (existing && (ACTIVE_OPERATION_STATUSES.has(existing.status) || this.inFlight.has(request.operationId))) {
      return {
        operation: existing,
        accepted: true,
        alreadyRunning: true
      };
    }

    const timestamp = this.now();
    const operation: OperationSummary = {
      operationId: request.operationId,
      scope: request.scope,
      resourceId: request.resourceId,
      action: request.action,
      status: "running",
      phase: request.phase,
      percent: request.percent,
      message: request.message,
      result: request.result,
      startedAt: timestamp,
      updatedAt: timestamp
    };

    await this.operations.create(operation);
    this.publisher.publishOperationUpdated(operation);
    this.scheduleWorker(operation, worker);

    return {
      operation,
      accepted: true,
      alreadyRunning: false
    };
  }

  async waitForIdle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight.values()]);
    }
  }

  private scheduleWorker(operation: OperationSummary, worker: OperationWorker): void {
    const promise = new Promise<void>((resolve) => {
      setTimeout(() => {
        void this.runWorker(operation, worker).finally(resolve);
      }, 0);
    }).finally(() => {
      if (this.inFlight.get(operation.operationId) === promise) {
        this.inFlight.delete(operation.operationId);
      }
    });

    this.inFlight.set(operation.operationId, promise);
  }

  private async runWorker(operation: OperationSummary, worker: OperationWorker): Promise<void> {
    let latest = operation;

    const update = async (patch: Partial<OperationSummary>): Promise<OperationSummary> => {
      const updated = await this.operations.update(operation.operationId, {
        ...patch,
        updatedAt: patch.updatedAt ?? this.now()
      });
      if (!updated) {
        throw new Error(`Operation ${operation.operationId} no longer exists.`);
      }
      latest = updated;
      this.publisher.publishOperationUpdated(updated);
      return updated;
    };

    try {
      const result = await worker({
        operation,
        update
      });
      const completed = await this.operations.complete(operation.operationId, {
        ...(result ?? {}),
        updatedAt: result?.updatedAt ?? this.now(),
        status: "completed"
      });
      if (completed) {
        this.publisher.publishOperationCompleted(completed);
      }
    } catch (error) {
      const failed = await this.operations.fail(operation.operationId, error, {
        phase: latest.phase,
        message: failureMessage(latest),
        retryable: true,
        updatedAt: this.now()
      });
      if (failed) {
        this.publisher.publishOperationCompleted(failed);
      }
    }
  }
}
