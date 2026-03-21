import type {
  ChatStreamEvent,
  ChannelSession,
  DeploymentTargetId,
  EngineStatus,
  SlackClawConfigResource,
  SlackClawDeployPhase,
  SlackClawTaskProgressStatus,
  SupportedChannelId
} from "@slackclaw/contracts";

import { EventBusService } from "./event-bus-service.js";

export class EventPublisher {
  constructor(private readonly bus: EventBusService) {}

  publishDeployProgress(args: {
    correlationId: string;
    targetId: DeploymentTargetId;
    phase: SlackClawDeployPhase;
    percent?: number;
    message: string;
  }): void {
    this.bus.publish({
      type: "deploy.progress",
      ...args
    });
  }

  publishDeployCompleted(args: {
    correlationId: string;
    targetId: DeploymentTargetId;
    status: "completed" | "failed";
    message: string;
    engineStatus: EngineStatus;
  }): void {
    this.bus.publish({
      type: "deploy.completed",
      ...args
    });
  }

  publishGatewayStatus(args: { reachable: boolean; pendingGatewayApply: boolean; summary: string }): void {
    this.bus.publish({
      type: "gateway.status",
      ...args
    });
  }

  publishTaskProgress(args: { taskId: string; status: SlackClawTaskProgressStatus; message: string }): void {
    this.bus.publish({
      type: "task.progress",
      ...args
    });
  }

  publishChatStream(args: {
    threadId: string;
    sessionKey: string;
    payload: ChatStreamEvent;
  }): void {
    this.bus.publish({
      type: "chat.stream",
      ...args
    });
  }

  publishConfigApplied(args: { resource: SlackClawConfigResource; summary: string }): void {
    this.bus.publish({
      type: "config.applied",
      ...args
    });
  }

  publishChannelSessionUpdated(args: { channelId: SupportedChannelId; session: ChannelSession }): void {
    this.bus.publish({
      type: "channel.session.updated",
      ...args
    });
  }
}
