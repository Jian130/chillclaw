import { describe, expect, it } from "vitest";
import type { AIMemberDetail, ChatThreadDetail, ChatThreadSummary, SlackClawEvent } from "@slackclaw/contracts";

import {
  applyChatEventToDetail,
  chatStreamEventFromDaemonEvent,
  memberNameForThread,
  preferredNewChatMemberId,
  sortChatThreads
} from "./ChatPage.js";

const members: AIMemberDetail[] = [
  {
    id: "member-1",
    agentId: "agent-1",
    source: "slackclaw",
    hasManagedMetadata: true,
    name: "Alex Morgan",
    jobTitle: "Research Lead",
    status: "ready",
    currentStatus: "Ready",
    activeTaskCount: 0,
    avatar: {
      presetId: "operator",
      accent: "var(--avatar-1)",
      emoji: "🦊"
    },
    teamIds: [],
    bindingCount: 0,
    bindings: [],
    lastUpdatedAt: "2026-03-14T01:00:00.000Z",
    personality: "",
    soul: "",
    workStyles: [],
    skillIds: [],
    knowledgePackIds: [],
    capabilitySettings: {
      memoryEnabled: true,
      contextWindow: 128000
    }
  }
];

const summary = (id: string, updatedAt: string): ChatThreadSummary => ({
  id,
  memberId: "member-1",
  agentId: "agent-1",
  sessionKey: `agent:agent-1:slackclaw-chat:${id}`,
  title: `Thread ${id}`,
  createdAt: "2026-03-14T00:00:00.000Z",
  updatedAt,
  lastMessageAt: updatedAt,
  unreadCount: 0,
  historyStatus: "ready",
  composerState: {
    status: "idle",
    canSend: true,
    canAbort: false
  }
});

function detail(): ChatThreadDetail {
  return {
    ...summary("thread-1", "2026-03-14T01:00:00.000Z"),
    messages: [
      {
        id: "user-1",
        role: "user",
        text: "Draft the weekly update."
      }
    ]
  };
}

describe("ChatPage helpers", () => {
  it("sorts chat threads with the most recently updated first", () => {
    const ordered = sortChatThreads([
      summary("older", "2026-03-14T00:00:00.000Z"),
      summary("newer", "2026-03-14T02:00:00.000Z")
    ]);

    expect(ordered.map((thread) => thread.id)).toEqual(["newer", "older"]);
  });

  it("resolves a friendly member name for thread cards", () => {
    expect(memberNameForThread(summary("thread-1", "2026-03-14T01:00:00.000Z"), members)).toBe("Alex Morgan");
  });

  it("prefers the left-side member selection when starting a new chat", () => {
    expect(preferredNewChatMemberId("member-1", members, "member-2")).toBe("member-1");
  });

  it("falls back to the selected thread member when all members are shown", () => {
    expect(preferredNewChatMemberId("all", members, "member-1")).toBe("member-1");
  });

  it("returns no preferred member when there is no concrete member context", () => {
    expect(preferredNewChatMemberId("all", members)).toBeUndefined();
  });

  it("applies assistant delta and completion events to the active detail", () => {
    const started = applyChatEventToDetail(detail(), {
      type: "run-started",
      threadId: "thread-1",
      message: {
        id: "thread-1:assistant:stream",
        role: "assistant",
        text: "",
        pending: true
      },
      activityLabel: "Thinking…"
    });

    expect(started?.composerState.status).toBe("thinking");

    const streaming = applyChatEventToDetail(started, {
      type: "assistant-delta",
      threadId: "thread-1",
      message: {
        id: "thread-1:assistant:stream",
        role: "assistant",
        text: "Working on it...",
        status: "streaming"
      },
      activityLabel: "Responding…"
    });

    expect(streaming?.messages.at(-1)?.text).toBe("Working on it...");
    expect(streaming?.composerState.status).toBe("streaming");

    const completed = applyChatEventToDetail(detail(), {
      type: "assistant-completed",
      threadId: "thread-1",
      detail: {
        ...detail(),
        composerState: {
          status: "idle",
          canSend: true,
          canAbort: false
        },
        messages: [
          ...detail().messages,
          {
            id: "assistant-final",
            role: "assistant",
            text: "Here is the completed draft."
          }
        ]
      }
    });

    expect(completed?.messages.at(-1)?.text).toBe("Here is the completed draft.");
    expect(completed?.composerState.canSend).toBe(true);
  });

  it("keeps failed detail when the assistant run aborts", () => {
    const aborted = applyChatEventToDetail(detail(), {
      type: "assistant-aborted",
      threadId: "thread-1",
      detail: {
        ...detail(),
        composerState: {
          status: "idle",
          canSend: true,
          canAbort: false
        },
        messages: [
          ...detail().messages,
          {
            id: "assistant-partial",
            role: "assistant",
            text: "Partial answer",
            interrupted: true,
            status: "failed"
          }
        ]
      }
    });

    expect(aborted?.messages.at(-1)?.interrupted).toBe(true);
    expect(aborted?.composerState.canSend).toBe(true);
  });

  it("extracts chat stream payloads from daemon events", () => {
    const chatEvent: SlackClawEvent = {
      type: "chat.stream",
      threadId: "thread-1",
      sessionKey: "agent:agent-1:slackclaw-chat:thread-1",
      payload: {
        type: "assistant-delta",
        threadId: "thread-1",
        activityLabel: "Responding…",
        message: {
          id: "thread-1:assistant:stream",
          role: "assistant",
          text: "Working on it...",
          status: "streaming"
        }
      }
    };

    expect(chatStreamEventFromDaemonEvent(chatEvent)).toEqual(chatEvent.payload);
  });

  it("ignores non-chat daemon events when deriving chat stream updates", () => {
    expect(
      chatStreamEventFromDaemonEvent({
        type: "gateway.status",
        reachable: true,
        pendingGatewayApply: false,
        summary: "Gateway is healthy."
      })
    ).toBeUndefined();
  });
});
