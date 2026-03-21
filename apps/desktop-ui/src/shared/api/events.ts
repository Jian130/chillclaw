import type { SlackClawEvent } from "@slackclaw/contracts";

import { resolveApiBase } from "./client.js";

type EventListener = (event: SlackClawEvent) => void;
type ErrorListener = (event: Event) => void;

const DEFAULT_RECONNECT_DELAY_MS = 1_000;

const eventListeners = new Set<EventListener>();
const errorListeners = new Set<ErrorListener>();

let activeSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = false;

function buildEventSocketUrl() {
  return resolveApiBase().replace(/^http/i, "ws") + "/events";
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (!shouldReconnect || eventListeners.size === 0 || reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ensureSocket();
  }, DEFAULT_RECONNECT_DELAY_MS);
}

function ensureSocket() {
  if (!shouldReconnect || eventListeners.size === 0 || activeSocket) {
    return;
  }

  const socket = new WebSocket(buildEventSocketUrl());
  activeSocket = socket;

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as SlackClawEvent;
      for (const listener of [...eventListeners]) {
        listener(payload);
      }
    } catch {
      // Ignore malformed events and keep the stream alive.
    }
  };

  socket.onerror = (event) => {
    for (const listener of [...errorListeners]) {
      listener(event);
    }
  };

  socket.onclose = () => {
    if (activeSocket === socket) {
      activeSocket = null;
    }

    scheduleReconnect();
  };
}

function closeSocket() {
  if (!activeSocket) {
    return;
  }

  const socket = activeSocket;
  activeSocket = null;
  socket.close();
}

export function subscribeToDaemonEvents(onEvent: EventListener, onError?: ErrorListener): () => void {
  eventListeners.add(onEvent);
  if (onError) {
    errorListeners.add(onError);
  }

  shouldReconnect = true;
  ensureSocket();

  return () => {
    eventListeners.delete(onEvent);
    if (onError) {
      errorListeners.delete(onError);
    }

    if (eventListeners.size > 0) {
      return;
    }

    shouldReconnect = false;
    clearReconnectTimer();
    closeSocket();
  };
}

export function resetDaemonEventStateForTests() {
  shouldReconnect = false;
  eventListeners.clear();
  errorListeners.clear();
  clearReconnectTimer();
  closeSocket();
}
