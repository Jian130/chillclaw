import type {
  ChannelSetupState,
  EngineCapabilities,
  EngineInstallSpec,
  EngineStatus,
  EngineTaskRequest,
  EngineTaskResult,
  HealthCheckResult,
  InstallResponse,
  PairingApprovalRequest,
  RecoveryAction,
  RecoveryRunResponse,
  TelegramSetupRequest,
  WechatSetupRequest
} from "@slackclaw/contracts";

export interface EngineAdapter {
  readonly installSpec: EngineInstallSpec;
  readonly capabilities: EngineCapabilities;

  install(autoConfigure: boolean, options?: { forceLocal?: boolean }): Promise<InstallResponse>;
  onboard(profileId: string): Promise<void>;
  configure(profileId: string): Promise<void>;
  status(): Promise<EngineStatus>;
  healthCheck(selectedProfileId?: string): Promise<HealthCheckResult[]>;
  runTask(request: EngineTaskRequest): Promise<EngineTaskResult>;
  update(): Promise<{ message: string; engineStatus: EngineStatus }>;
  repair(action: RecoveryAction): Promise<RecoveryRunResponse>;
  exportDiagnostics(): Promise<{ filename: string; content: string }>;
  getChannelState(channelId: "telegram" | "whatsapp" | "wechat"): Promise<ChannelSetupState>;
  configureTelegram(request: TelegramSetupRequest): Promise<{ message: string; channel: ChannelSetupState }>;
  startWhatsappLogin(): Promise<{ message: string; channel: ChannelSetupState }>;
  approvePairing(channelId: "telegram" | "whatsapp", request: PairingApprovalRequest): Promise<{ message: string; channel: ChannelSetupState }>;
  configureWechatWorkaround(request: WechatSetupRequest): Promise<{ message: string; channel: ChannelSetupState }>;
  startGatewayAfterChannels(): Promise<{ message: string; engineStatus: EngineStatus }>;
}
