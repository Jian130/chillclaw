import type { ChillClawEvent } from "@chillclaw/contracts";

import { resolveApiBase } from "./client.js";

type EventListener = (event: ChillClawEvent) => void;
type ErrorListener = (event: Event) => void;
export type DaemonSocketConnectionState = "connecting" | "connected" | "reconnecting" | "closed" | "error";

export interface DaemonResourceRevisionState {
  epoch: string;
  revision: number;
}

export interface DaemonEventTransportState {
  connectionState: DaemonSocketConnectionState;
  lastError?: string;
  lastSeenByResource: Partial<Record<string, DaemonResourceRevisionState>>;
}

type StateListener = (state: DaemonEventTransportState) => void;

const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const EVENT_STREAM_STALE_MS = 45_000;
const COMMUNICATION_LOG_PREFIX = "[ChillClaw communication]";

const eventListeners = new Set<EventListener>();
const errorListeners = new Set<ErrorListener>();
const stateListeners = new Set<StateListener>();

let activeSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = false;
let connectionState: DaemonSocketConnectionState = "closed";
let lastError: string | undefined;
const lastSeenByResource = new Map<string, DaemonResourceRevisionState>();

function buildEventSocketUrl() {
  return resolveApiBase().replace(/^http/i, "ws") + "/events";
}

function logCommunication(event: string, details: Record<string, unknown>) {
  if (typeof console === "undefined" || typeof console.debug !== "function") {
    return;
  }

  console.debug(COMMUNICATION_LOG_PREFIX, event, details);
}

function eventCommunicationSummary(event: ChillClawEvent): Record<string, unknown> {
  switch (event.type) {
    case "overview.updated":
    case "ai-team.updated":
    case "model-config.updated":
    case "channel-config.updated":
    case "skill-catalog.updated":
    case "plugin-config.updated":
    case "preset-skill-sync.updated":
    case "downloads.updated":
      return {
        eventType: event.type,
        revision: event.snapshot.revision,
        epoch: event.snapshot.epoch
      };
    case "operation.updated":
    case "operation.completed":
      return {
        eventType: event.type,
        operationId: event.operation.data.operationId,
        operationScope: event.operation.data.scope,
        operationAction: event.operation.data.action,
        operationStatus: event.operation.data.status,
        operationPhase: event.operation.data.phase,
        revision: event.operation.revision
      };
    case "channel.session.updated":
      return {
        eventType: event.type,
        channelId: event.channelId
      };
    case "chat.stream":
      return {
        eventType: event.type,
        threadId: event.threadId,
        payloadType: event.payload.type
      };
    default:
      return {
        eventType: event.type
      };
  }
}

function currentState(): DaemonEventTransportState {
  return {
    connectionState,
    lastError,
    lastSeenByResource: Object.fromEntries(lastSeenByResource.entries())
  };
}

function emitState() {
  const snapshot = currentState();
  for (const listener of [...stateListeners]) {
    listener(snapshot);
  }
}

function setConnectionState(next: DaemonSocketConnectionState, error?: string) {
  connectionState = next;
  if (error !== undefined || next === "connected" || next === "closed") {
    lastError = error;
  }
  emitState();
}

function updateResourceRevision(event: ChillClawEvent) {
  switch (event.type) {
    case "overview.updated":
      lastSeenByResource.set("overview", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "ai-team.updated":
      lastSeenByResource.set("ai-team", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "model-config.updated":
      lastSeenByResource.set("model-config", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "channel-config.updated":
      lastSeenByResource.set("channel-config", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "skill-catalog.updated":
      lastSeenByResource.set("skill-catalog", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "plugin-config.updated":
      lastSeenByResource.set("plugin-config", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "preset-skill-sync.updated":
      lastSeenByResource.set("preset-skill-sync", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "downloads.updated":
      lastSeenByResource.set("downloads", { epoch: event.snapshot.epoch, revision: event.snapshot.revision });
      break;
    case "operation.updated":
    case "operation.completed":
      lastSeenByResource.set(`operation:${event.operation.data.operationId}`, {
        epoch: event.operation.epoch,
        revision: event.operation.revision
      });
      break;
    default:
      return;
  }

  emitState();
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearStaleTimer() {
  if (staleTimer) {
    clearTimeout(staleTimer);
    staleTimer = null;
  }
}

function markStreamActivity(socket: WebSocket) {
  if (activeSocket !== socket) {
    return;
  }

  clearStaleTimer();
  staleTimer = setTimeout(() => {
    if (activeSocket !== socket) {
      return;
    }

    activeSocket = null;
    setConnectionState("reconnecting", "The event stream stopped responding.");
    socket.close();
    scheduleReconnect();
  }, EVENT_STREAM_STALE_MS);
}

function scheduleReconnect() {
  if (!shouldReconnect || eventListeners.size === 0 || reconnectTimer) {
    return;
  }

  setConnectionState("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ensureSocket();
  }, DEFAULT_RECONNECT_DELAY_MS);
}

function ensureSocket() {
  if (!shouldReconnect || eventListeners.size === 0 || activeSocket) {
    return;
  }

  setConnectionState(connectionState === "connected" ? "reconnecting" : "connecting");
  const url = buildEventSocketUrl();
  logCommunication("events.socket.connecting", { url });
  const socket = new WebSocket(url);
  activeSocket = socket;

  socket.onopen = () => {
    if (activeSocket === socket) {
      logCommunication("events.socket.open", { url });
      setConnectionState("connected");
      markStreamActivity(socket);
    }
  };

  socket.onmessage = (event) => {
    markStreamActivity(socket);
    try {
      const payload = JSON.parse(event.data) as ChillClawEvent;
      if (payload.type === "daemon.heartbeat") {
        return;
      }
      logCommunication("events.socket.message", eventCommunicationSummary(payload));
      updateResourceRevision(payload);
      for (const listener of [...eventListeners]) {
        listener(payload);
      }
    } catch (error) {
      logCommunication("events.socket.malformed-message", {
        message: error instanceof Error ? error.message : String(error)
      });
      // Ignore malformed events and keep the stream alive.
    }
  };

  socket.onerror = (event) => {
    logCommunication("events.socket.error", {
      listenerCount: eventListeners.size
    });
    setConnectionState("error", "The event stream encountered an error.");
    for (const listener of [...errorListeners]) {
      listener(event);
    }
  };

  socket.onclose = () => {
    logCommunication("events.socket.close", {
      shouldReconnect,
      listenerCount: eventListeners.size
    });
    if (activeSocket === socket) {
      activeSocket = null;
    }
    clearStaleTimer();

    if (shouldReconnect && eventListeners.size > 0) {
      scheduleReconnect();
      return;
    }

    setConnectionState("closed");
  };
}

function closeSocket() {
  if (!activeSocket) {
    return;
  }

  const socket = activeSocket;
  activeSocket = null;
  clearStaleTimer();
  socket.close();
}

export function subscribeToDaemonEvents(onEvent: EventListener, onError?: ErrorListener, onState?: StateListener): () => void {
  eventListeners.add(onEvent);
  if (onError) {
    errorListeners.add(onError);
  }
  if (onState) {
    stateListeners.add(onState);
    onState(currentState());
  }

  shouldReconnect = true;
  ensureSocket();

  return () => {
    eventListeners.delete(onEvent);
    if (onError) {
      errorListeners.delete(onError);
    }
    if (onState) {
      stateListeners.delete(onState);
    }

    if (eventListeners.size > 0) {
      return;
    }

    shouldReconnect = false;
    clearReconnectTimer();
    closeSocket();
    setConnectionState("closed");
  };
}

export function getDaemonEventTransportState(): DaemonEventTransportState {
  return currentState();
}

export function getDaemonResourceRevision(resource: string): DaemonResourceRevisionState | undefined {
  return lastSeenByResource.get(resource);
}

export function resetDaemonEventStateForTests() {
  shouldReconnect = false;
  eventListeners.clear();
  errorListeners.clear();
  stateListeners.clear();
  clearReconnectTimer();
  clearStaleTimer();
  closeSocket();
  lastSeenByResource.clear();
  connectionState = "closed";
  lastError = undefined;
}
