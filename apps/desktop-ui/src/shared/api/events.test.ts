import { afterEach, describe, expect, it, vi } from "vitest";

class FakeWebSocket {
  static readonly instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closeCallCount = 0;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  emitMessage(data: string) {
    this.onmessage?.({ data });
  }

  emitClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new Event("close"));
  }

  close() {
    this.closeCallCount += 1;
    this.readyState = FakeWebSocket.CLOSED;
  }

  static reset() {
    FakeWebSocket.instances.length = 0;
  }
}

async function loadEventsModule() {
  return import("./events.js");
}

afterEach(async () => {
  vi.useRealTimers();
  try {
    const events = await loadEventsModule();
    events.resetDaemonEventStateForTests();
  } catch {
    // Ignore when the module does not exist yet during the red phase.
  }
  FakeWebSocket.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("daemon event client", () => {
  it("decodes daemon WebSocket JSON messages", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const events = await loadEventsModule();
    const received: unknown[] = [];

    const unsubscribe = events.subscribeToDaemonEvents((event) => {
      received.push(event);
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]?.url).toBe("ws://127.0.0.1:4545/api/events");

    FakeWebSocket.instances[0]?.emitMessage(
      JSON.stringify({
        type: "gateway.status",
        reachable: true,
        pendingGatewayApply: false,
        summary: "Ready"
      })
    );

    expect(received).toEqual([
      {
        type: "gateway.status",
        reachable: true,
        pendingGatewayApply: false,
        summary: "Ready"
      }
    ]);

    unsubscribe();
  });

  it("reconnects after the socket closes while listeners remain", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const events = await loadEventsModule();

    const unsubscribe = events.subscribeToDaemonEvents(() => undefined);

    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0]?.emitClose();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1]?.url).toBe("ws://127.0.0.1:4545/api/events");

    unsubscribe();
  });

  it("shares one socket across subscribers and closes it after the last unsubscribe", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const events = await loadEventsModule();

    const firstUnsubscribe = events.subscribeToDaemonEvents(() => undefined);
    const secondUnsubscribe = events.subscribeToDaemonEvents(() => undefined);

    expect(FakeWebSocket.instances).toHaveLength(1);

    firstUnsubscribe();
    expect(FakeWebSocket.instances[0]?.closeCallCount).toBe(0);

    secondUnsubscribe();

    expect(FakeWebSocket.instances[0]?.closeCallCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
