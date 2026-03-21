import type { SlackClawEvent } from "@slackclaw/contracts";

export type EventBusListener = (event: SlackClawEvent) => void;

export class EventBusService {
  private readonly listeners = new Set<EventBusListener>();

  subscribe(listener: EventBusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: SlackClawEvent): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}
