import type {
  OperationErrorSummary,
  OperationScope,
  OperationSummary
} from "@chillclaw/contracts";

import { StateStore } from "./state-store.js";

export interface OperationLookup {
  scope: OperationScope;
  resourceId?: string;
  action: string;
}

export interface OperationFailureUpdate {
  phase?: string;
  message: string;
  retryable?: boolean;
  updatedAt: string;
}

const ACTIVE_OPERATION_STATUSES = new Set<OperationSummary["status"]>(["pending", "running", "timed-out"]);

function operationMatchesLookup(operation: OperationSummary, lookup: OperationLookup): boolean {
  return operation.scope === lookup.scope &&
    operation.action === lookup.action &&
    operation.resourceId === lookup.resourceId;
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && code.trim() ? code.trim() : undefined;
  }

  return undefined;
}

function failureSummary(error: unknown, update: OperationFailureUpdate): OperationErrorSummary {
  return {
    code: errorCode(error),
    message: update.message,
    retryable: update.retryable
  };
}

export class OperationStore {
  constructor(private readonly store: StateStore) {}

  async create(operation: OperationSummary): Promise<OperationSummary> {
    const nextOperation = { ...operation };
    await this.store.update((current) => ({
      ...current,
      operations: {
        ...(current.operations ?? {}),
        [nextOperation.operationId]: nextOperation
      }
    }));
    return nextOperation;
  }

  async read(operationId: string): Promise<OperationSummary | undefined> {
    return (await this.store.read()).operations?.[operationId];
  }

  async findActive(lookup: OperationLookup): Promise<OperationSummary | undefined> {
    const operations = Object.values((await this.store.read()).operations ?? {});
    return operations.find((operation) => ACTIVE_OPERATION_STATUSES.has(operation.status) && operationMatchesLookup(operation, lookup));
  }

  async update(operationId: string, patch: Partial<OperationSummary>): Promise<OperationSummary | undefined> {
    let nextOperation: OperationSummary | undefined;
    await this.store.update((current) => {
      const existing = current.operations?.[operationId];
      if (!existing) {
        return current;
      }

      nextOperation = {
        ...existing,
        ...patch,
        operationId: existing.operationId,
        scope: existing.scope,
        action: existing.action,
        startedAt: existing.startedAt
      };

      return {
        ...current,
        operations: {
          ...(current.operations ?? {}),
          [operationId]: nextOperation
        }
      };
    });
    return nextOperation;
  }

  async complete(operationId: string, patch: Partial<OperationSummary>): Promise<OperationSummary | undefined> {
    return this.update(operationId, {
      ...patch,
      status: "completed"
    });
  }

  async fail(operationId: string, error: unknown, update: OperationFailureUpdate): Promise<OperationSummary | undefined> {
    return this.update(operationId, {
      phase: update.phase,
      message: update.message,
      retryable: update.retryable,
      updatedAt: update.updatedAt,
      status: "failed",
      error: failureSummary(error, update)
    });
  }
}
