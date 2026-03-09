import { useEffect, useState } from "react";

import type {
  ChannelSetupState,
  EngineTaskResult,
  HealthCheckResult,
  InstallResponse,
  ProductOverview,
  RecoveryAction,
  SetupStepResult,
  TaskTemplate
} from "@slackclaw/contracts";

import {
  approveTelegramPairing,
  approveWhatsappPairing,
  completeOnboarding,
  exportDiagnostics,
  fetchOverview,
  installAppService,
  installSlackClaw,
  markFirstRunIntroComplete,
  restartAppService,
  runFirstRunSetup,
  runRecovery,
  runTask,
  runUpdate,
  setupTelegramChannel,
  setupWechatWorkaround,
  startGatewayAfterChannels,
  startWhatsappLogin,
  stopSlackClawApp,
  uninstallSlackClawApp,
  uninstallAppService
} from "./api.js";
import { detectLocale, localeOptions, t, type Locale } from "./i18n.js";

function SectionHeader(props: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className="section-header">
      <p className="eyebrow">{props.eyebrow}</p>
      <h2>{props.title}</h2>
      <p className="detail">{props.detail}</p>
    </header>
  );
}

function summarizeInstallDisposition(locale: Locale, install: InstallResponse): string {
  switch (install.disposition) {
    case "reused-existing":
      return t(locale, "installOutcomeReused");
    case "installed":
      return t(locale, "installOutcomeInstalled");
    case "reinstalled":
      return t(locale, "installOutcomeReinstalled");
    case "onboarded":
      return t(locale, "installOutcomeOnboarded");
    default:
      return install.message;
  }
}

function formatInstallSource(locale: Locale, source: ProductOverview["installSpec"]["installSource"]): string {
  switch (source) {
    case "npm-local":
      return t(locale, "installSourceManagedLocal");
    case "npm-global":
      return t(locale, "installSourceGlobal");
    default:
      return source;
  }
}

function severityRank(check: HealthCheckResult): number {
  switch (check.severity) {
    case "error":
      return 3;
    case "warning":
      return 2;
    case "info":
      return 1;
    default:
      return 0;
  }
}

function setupStepTitle(locale: Locale, step: SetupStepResult): string {
  switch (step.id) {
    case "check-existing-openclaw":
      return t(locale, "setupStepCheckOpenClaw");
    case "prepare-openclaw":
      return t(locale, "setupStepPrepareOpenClaw");
    case "onboarding-required":
      return t(locale, "onboardingTitle");
    case "ensure-engine-running":
      return t(locale, "setupStepEnsureRunning");
    default:
      return step.title;
  }
}

function SetupStepStatus(props: { status: SetupStepResult["status"] }) {
  return <span className={`status-pill ${props.status === "completed" ? "ok" : "warning"}`}>{props.status}</span>;
}

function AppControlButtons(props: {
  locale: Locale;
  busy: string | null;
  onAction: (action: "stop" | "uninstall") => Promise<void>;
}) {
  return (
    <div className="action-row">
      <button className="ghost" onClick={() => void props.onAction("stop")} disabled={props.busy !== null}>
        {props.busy === "app-stop" ? t(props.locale, "stoppingApp") : t(props.locale, "stopApp")}
      </button>
      <button className="ghost" onClick={() => void props.onAction("uninstall")} disabled={props.busy !== null}>
        {props.busy === "app-uninstall" ? t(props.locale, "uninstallingApp") : t(props.locale, "uninstallApp")}
      </button>
    </div>
  );
}

function LoadingIndicator(props: { label: string }) {
  return (
    <div className="loading-indicator" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <strong>{props.label}</strong>
    </div>
  );
}

function channelStatusClass(status: ChannelSetupState["status"]): string {
  return status === "completed" || status === "ready" ? "ok" : "warning";
}

function gatewayDisplayStatus(overview: ProductOverview): { label: string; tone: "ok" | "warning" } {
  if (overview.engine.running) {
    return { label: "Reachable", tone: "ok" };
  }

  return { label: "Pending setup", tone: "warning" };
}

function installHealthChip(overview: ProductOverview): { label: string; tone: "ok" | "warning" } {
  if (overview.engine.installed) {
    return {
      label: overview.engine.running ? "OpenClaw ready" : "OpenClaw deployed",
      tone: overview.engine.running ? "ok" : "warning"
    };
  }

  return { label: "OpenClaw not detected", tone: "warning" };
}

function EnvironmentCheckCard(props: { overview: ProductOverview; locale: Locale }) {
  const gatewayStatus = gatewayDisplayStatus(props.overview);
  const chip = installHealthChip(props.overview);

  return (
    <section className="design-card environment-card">
      <div className="design-card-header">
        <strong>Environment check</strong>
        <span className={`status-pill ${chip.tone}`}>{chip.label}</span>
      </div>
      <div className="env-rows">
        <div className="env-row">
          <span>Device OS</span>
          <strong>{props.overview.platformTarget}</strong>
        </div>
        <div className="env-row">
          <span>{t(props.locale, "installSource")}</span>
          <strong>{formatInstallSource(props.locale, props.overview.installSpec.installSource)}</strong>
        </div>
        <div className="env-row">
          <span>OpenClaw runtime</span>
          <strong>{props.overview.engine.version ?? "Not installed"}</strong>
        </div>
        <div className="env-row">
          <span>Gateway</span>
          <strong className={gatewayStatus.tone === "ok" ? "tone-ok" : "tone-warning"}>{gatewayStatus.label}</strong>
        </div>
      </div>
    </section>
  );
}

function SetupWizardCard(props: {
  locale: Locale;
  onboardingCompleted: boolean;
  nextChannelId?: ProductOverview["channelSetup"]["nextChannelId"];
  busy: string | null;
  selectedProfileId: string;
  profiles: ProductOverview["profiles"];
  onSelectProfile: (profileId: string) => void;
  onCompleteOnboarding: () => Promise<void>;
  gatewayStarted: boolean;
}) {
  const stepOneDone = props.onboardingCompleted;
  const stepTwoDone = props.gatewayStarted;
  const currentProfile = props.profiles.find((profile) => profile.id === props.selectedProfileId);

  return (
    <section className="panel workspace-panel wizard-panel">
      <SectionHeader
        eyebrow={t(props.locale, "onboardingEyebrow")}
        title="Configure OpenClaw in guided steps"
        detail="Based on the current SlackClaw flow: deploy first, then onboarding defaults, then channel pairing, then gateway start."
      />
      <div className="wizard-steps">
        <article className={`wizard-step ${stepOneDone ? "done" : "active"}`}>
          <div className="wizard-step-head">
            <strong>1. Run onboarding defaults</strong>
            <span className={`wizard-badge ${stepOneDone ? "done" : "required"}`}>{stepOneDone ? "Complete" : "Required"}</span>
          </div>
          <p>Pick a default workflow profile and let SlackClaw write the OpenClaw onboarding defaults for this machine.</p>
          <div className="profile-grid compact">
            {props.profiles.map((profile) => (
              <button
                key={profile.id}
                className={`profile-card ${props.selectedProfileId === profile.id ? "selected" : ""}`}
                onClick={() => props.onSelectProfile(profile.id)}
              >
                <strong>{profile.name}</strong>
                <span>{profile.description}</span>
              </button>
            ))}
          </div>
          <div className="wizard-step-footer">
            <span className="micro">Current default: {currentProfile?.name ?? props.selectedProfileId}</span>
            <button className="primary" onClick={() => void props.onCompleteOnboarding()} disabled={props.busy !== null}>
              {props.busy === "onboarding" ? t(props.locale, "savingDefaults") : t(props.locale, "completeOnboarding")}
            </button>
          </div>
        </article>

        <article className={`wizard-step ${stepOneDone ? (stepTwoDone ? "done" : "next") : "locked"}`}>
          <div className="wizard-step-head">
            <strong>2. Pair channels and start gateway</strong>
            <span className={`wizard-badge ${stepOneDone ? (stepTwoDone ? "done" : "next") : "locked"}`}>
              {!stepOneDone ? "Locked" : stepTwoDone ? "Complete" : props.nextChannelId ? "Next" : "Ready"}
            </span>
          </div>
          <p>
            SlackClaw will guide Telegram first, then WhatsApp, then the experimental WeChat workaround, and only then restart the gateway.
          </p>
          <ul className="wizard-bullets">
            <li>Start OpenClaw pairing flows inside SlackClaw.</li>
            <li>Approve pairing codes for each supported channel.</li>
            <li>Restart the gateway after every required channel step is complete.</li>
          </ul>
          <div className="wizard-step-footer">
            <span className="micro">
              {!stepOneDone ? t(props.locale, "baseOnboardingPending") : props.nextChannelId ? `Next channel: ${props.nextChannelId}` : "All channels configured"}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}

function ChatConsolePreview(props: {
  locale: Locale;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  setPrompt: (value: string) => void;
  templates: TaskTemplate[];
  selectedTemplate?: TaskTemplate;
  prompt: string;
  onPromptChange: (value: string) => void;
  workflowReady: boolean;
  gatewaySummary: string;
  busy: string | null;
  onRun: () => Promise<void>;
  taskResult: EngineTaskResult | null;
}) {
  return (
    <section className="panel workspace-panel console-panel">
      <SectionHeader
        eyebrow={t(props.locale, "firstTaskEyebrow")}
        title="Live Chat Console"
        detail="Use a starter task on the left, then run it through SlackClaw’s local OpenClaw session on the right."
      />
      <div className="console-wrap">
        <aside className="console-sidebar">
          <span className="console-label">Channels</span>
          {props.templates.map((template) => (
            <button
              key={template.id}
              className={`console-channel ${props.selectedTemplateId === template.id ? "selected" : ""}`}
              onClick={() => {
                props.setSelectedTemplateId(template.id);
                props.setPrompt(template.promptHint);
              }}
            >
              {template.title}
            </button>
          ))}
        </aside>
        <div className="console-chat">
          <p className="console-meta">
            Session: slackclaw-local | Model: default | Channel: {props.selectedTemplate?.title ?? "Starter task"}
          </p>
          <div className="console-messages">
            <article className="console-message user">
              <strong>User</strong>
              <p>{props.prompt || props.selectedTemplate?.promptHint || "Type command or prompt..."}</p>
            </article>
            <article className="console-message bot">
              <strong>SlackClaw</strong>
              <p>
                {props.taskResult?.summary ??
                  "OpenClaw will reply here after onboarding is complete, your channels are configured, and the gateway is running."}
              </p>
            </article>
          </div>
          <div className="console-composer">
            <label>
              <span>{t(props.locale, "prompt")}</span>
              <textarea
                value={props.prompt}
                onChange={(event) => props.onPromptChange(event.target.value)}
                placeholder={props.selectedTemplate?.promptHint ?? "Type command or prompt..."}
              />
            </label>
            {!props.workflowReady ? <p className="detail">{props.gatewaySummary}</p> : null}
            <div className="action-row">
              <button className="primary" onClick={() => void props.onRun()} disabled={props.busy !== null || !props.workflowReady}>
                {props.busy === "task" ? t(props.locale, "runningTask") : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {props.taskResult ? (
        <div className="result-card console-result">
          <h3>{t(props.locale, "latestResult")}</h3>
          <p className="result-summary">{props.taskResult.summary}</p>
          <pre>{props.taskResult.output}</pre>
          <div className="chip-row">
            {props.taskResult.nextActions.map((action) => (
              <span key={action} className="chip">
                {action}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function attemptCloseUi() {
  if (typeof window === "undefined") {
    return;
  }

  window.setTimeout(() => {
    window.close();
    window.location.replace("about:blank");
  }, 500);
}

export default function App() {
  const [overview, setOverview] = useState<ProductOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("email-admin");
  const [selectedTemplateId, setSelectedTemplateId] = useState("summarize-thread");
  const [prompt, setPrompt] = useState("");
  const [taskResult, setTaskResult] = useState<EngineTaskResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastInstall, setLastInstall] = useState<InstallResponse | null>(null);
  const [locale, setLocale] = useState<Locale>(detectLocale());
  const [setupSteps, setSetupSteps] = useState<SetupStepResult[]>([]);
  const [setupAutostarted, setSetupAutostarted] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramAccountName, setTelegramAccountName] = useState("");
  const [telegramPairingCode, setTelegramPairingCode] = useState("");
  const [whatsappPairingCode, setWhatsappPairingCode] = useState("");
  const [wechatPluginSpec, setWechatPluginSpec] = useState("@openclaw-china/wecom-app");
  const [wechatCorpId, setWechatCorpId] = useState("");
  const [wechatAgentId, setWechatAgentId] = useState("");
  const [wechatSecret, setWechatSecret] = useState("");
  const [wechatToken, setWechatToken] = useState("");
  const [wechatEncodingAesKey, setWechatEncodingAesKey] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem("slackclaw.locale") as Locale | null;
    if (stored && localeOptions.some((option) => option.value === stored)) {
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (overview?.firstRun.selectedProfileId) {
      setSelectedProfileId(overview.firstRun.selectedProfileId);
    }
  }, [overview?.firstRun.selectedProfileId]);

  useEffect(() => {
    const whatsappState = overview?.channelSetup.channels.find((channel) => channel.id === "whatsapp");

    if (!whatsappState || (whatsappState.status !== "in-progress" && whatsappState.status !== "awaiting-pairing")) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadOverview();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [overview?.channelSetup.channels]);

  useEffect(() => {
    if (!overview?.firstRun.introCompleted || overview.firstRun.setupCompleted || setupAutostarted) {
      return;
    }

    setSetupAutostarted(true);
    void handleFirstRunSetup();
  }, [overview?.firstRun.introCompleted, overview?.firstRun.setupCompleted, setupAutostarted]);

  function selectLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("slackclaw.locale", nextLocale);
    }
  }

  const selectedTemplate: TaskTemplate | undefined = overview?.templates.find(
    (template) => template.id === selectedTemplateId
  );
  const isDeploying =
    busy === "first-run-local-deploy" || busy === "first-run-setup" || busy === "install-local" || busy === "install";
  const telegramChannel = overview?.channelSetup.channels.find((channel) => channel.id === "telegram");
  const whatsappChannel = overview?.channelSetup.channels.find((channel) => channel.id === "whatsapp");
  const wechatChannel = overview?.channelSetup.channels.find((channel) => channel.id === "wechat");
  const nextChannelId = overview?.channelSetup.nextChannelId;
  const onboardingCompleted = Boolean(overview?.channelSetup.baseOnboardingCompleted);
  const workflowReady =
    onboardingCompleted && Boolean(overview?.channelSetup.gatewayStarted) && Boolean(overview?.engine.running);

  const criticalChecks = (overview?.healthChecks ?? [])
    .filter((check) => check.severity === "error" || check.severity === "warning")
    .sort((left, right) => severityRank(right) - severityRank(left));

  const recommendedRecoveryActions = (overview?.recoveryActions ?? []).filter((action) =>
    criticalChecks.some((check) => check.remediationActionIds.includes(action.id))
  );

  const prioritizedRecoveryActions: RecoveryAction[] =
    recommendedRecoveryActions.length > 0
      ? [
          ...recommendedRecoveryActions,
          ...(overview?.recoveryActions ?? []).filter(
            (action) => !recommendedRecoveryActions.some((candidate) => candidate.id === action.id)
          )
        ]
      : (overview?.recoveryActions ?? []);

  async function loadOverview() {
    try {
      setError(null);
      const nextOverview = await fetchOverview();
      setOverview(nextOverview);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t(locale, "loadFailed"));
    }
  }

  async function handleGetStarted() {
    setBusy("first-run-intro");
    setError(null);
    setNotice(null);
    setSetupSteps([]);
    setSetupAutostarted(false);

    try {
      const nextOverview = await markFirstRunIntroComplete();
      setOverview(nextOverview);
    } catch (introError) {
      setError(introError instanceof Error ? introError.message : t(locale, "loadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleFirstRunSetup() {
    setBusy("first-run-setup");
    setError(null);
    setNotice(null);

    try {
      const result = await runFirstRunSetup();
      setOverview(result.overview);
      setSetupSteps(result.steps);
      setLastInstall(result.install ?? null);

      if (result.status === "completed") {
        setNotice(t(locale, "setupCompletedNotice"));
      } else {
        setError(t(locale, "setupFailedNotice"));
      }
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : t(locale, "installFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleLocalDeploySetup() {
    setBusy("first-run-local-deploy");
    setError(null);
    setNotice(null);

    try {
      const result = await runFirstRunSetup(true);
      setOverview(result.overview);
      setSetupSteps(result.steps);
      setLastInstall(result.install ?? null);

      if (result.status === "completed") {
        setNotice(t(locale, "setupCompletedNotice"));
      } else {
        setError(result.install?.message ?? t(locale, "setupFailedNotice"));
      }
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : t(locale, "installFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleInstall() {
    setBusy("install");
    setNotice(null);
    setError(null);
    try {
      const result = await installSlackClaw(true);
      setOverview(result.overview);
      setLastInstall(result.install);
      setNotice(summarizeInstallDisposition(locale, result.install));
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : t(locale, "installFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleInstallLocal() {
    setBusy("install-local");
    setNotice(null);
    setError(null);
    try {
      const result = await installSlackClaw(true, true);
      setOverview(result.overview);
      setLastInstall(result.install);
      setNotice(summarizeInstallDisposition(locale, result.install));
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : t(locale, "installFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleTelegramSetup() {
    if (!telegramToken.trim()) {
      setError(t(locale, "telegramTokenRequired"));
      return;
    }

    setBusy("channel-telegram");
    setError(null);
    setNotice(null);

    try {
      const result = await setupTelegramChannel({
        token: telegramToken.trim(),
        accountName: telegramAccountName.trim() || undefined
      });
      setOverview(result.overview);
      setNotice(result.message);
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : t(locale, "setupFailedNotice"));
    } finally {
      setBusy(null);
    }
  }

  async function handleTelegramApprove() {
    if (!telegramPairingCode.trim()) {
      setError(t(locale, "pairingCodeRequired"));
      return;
    }

    setBusy("channel-telegram-approve");
    setError(null);
    setNotice(null);

    try {
      const result = await approveTelegramPairing({ code: telegramPairingCode.trim() });
      setOverview(result.overview);
      setNotice(result.message);
      setTelegramPairingCode("");
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : t(locale, "setupFailedNotice"));
    } finally {
      setBusy(null);
    }
  }

  async function handleWhatsappLogin() {
    setBusy("channel-whatsapp-login");
    setError(null);
    setNotice(null);

    try {
      const result = await startWhatsappLogin();
      setOverview(result.overview);
      setNotice(result.message);
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : t(locale, "setupFailedNotice"));
    } finally {
      setBusy(null);
    }
  }

  async function handleWhatsappApprove() {
    if (!whatsappPairingCode.trim()) {
      setError(t(locale, "pairingCodeRequired"));
      return;
    }

    setBusy("channel-whatsapp-approve");
    setError(null);
    setNotice(null);

    try {
      const result = await approveWhatsappPairing({ code: whatsappPairingCode.trim() });
      setOverview(result.overview);
      setNotice(result.message);
      setWhatsappPairingCode("");
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : t(locale, "setupFailedNotice"));
    } finally {
      setBusy(null);
    }
  }

  async function handleWechatSetup() {
    if (!wechatCorpId.trim() || !wechatAgentId.trim() || !wechatSecret.trim() || !wechatToken.trim() || !wechatEncodingAesKey.trim()) {
      setError(t(locale, "wechatFieldsRequired"));
      return;
    }

    setBusy("channel-wechat");
    setError(null);
    setNotice(null);

    try {
      const result = await setupWechatWorkaround({
        pluginSpec: wechatPluginSpec.trim() || undefined,
        corpId: wechatCorpId.trim(),
        agentId: wechatAgentId.trim(),
        secret: wechatSecret.trim(),
        token: wechatToken.trim(),
        encodingAesKey: wechatEncodingAesKey.trim()
      });
      setOverview(result.overview);
      setNotice(result.message);
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : t(locale, "setupFailedNotice"));
    } finally {
      setBusy(null);
    }
  }

  async function handleChannelGatewayStart() {
    setBusy("channel-gateway");
    setError(null);
    setNotice(null);

    try {
      const result = await startGatewayAfterChannels();
      setOverview(result.overview);
      setNotice(result.message);
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : t(locale, "setupFailedNotice"));
    } finally {
      setBusy(null);
    }
  }

  async function handleOnboarding() {
    setBusy("onboarding");
    setNotice(null);
    setError(null);
    try {
      const nextOverview = await completeOnboarding({ profileId: selectedProfileId });
      setOverview(nextOverview);
      setNotice(t(locale, "onboardingReady"));
    } catch (onboardingError) {
      setError(onboardingError instanceof Error ? onboardingError.message : t(locale, "onboardingFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRunTask() {
    if (!prompt.trim()) {
      setError(t(locale, "enterPrompt"));
      return;
    }

    setBusy("task");
    setError(null);
    setNotice(null);

    try {
      const result = await runTask({
        profileId: selectedProfileId,
        templateId: selectedTemplateId,
        prompt
      });
      setTaskResult(result);
      await loadOverview();
      setNotice(result.status === "completed" ? t(locale, "taskCompleted") : t(locale, "taskFailedNotice"));
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : t(locale, "taskFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRecovery(actionId: string) {
    setBusy(actionId);
    setNotice(null);
    setError(null);
    try {
      const result = await runRecovery(actionId);
      setOverview(result.overview);
      setNotice(result.result.message);
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : t(locale, "recoveryFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdate() {
    setBusy("update");
    setError(null);
    try {
      const result = await runUpdate();
      setNotice(result.message);
      await loadOverview();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t(locale, "updateFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleExportDiagnostics() {
    setBusy("diagnostics");
    setError(null);
    try {
      const result = await exportDiagnostics();
      setNotice(`${result.message} ${result.path}`);
    } catch (diagnosticsError) {
      setError(diagnosticsError instanceof Error ? diagnosticsError.message : t(locale, "exportFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleServiceAction(action: "install" | "restart" | "uninstall") {
    setBusy(`service-${action}`);
    setError(null);
    setNotice(null);

    try {
      const result =
        action === "install"
          ? await installAppService()
          : action === "restart"
            ? await restartAppService()
            : await uninstallAppService();

      setOverview(result.overview);
      setNotice(result.result.message);
    } catch (serviceError) {
      setError(serviceError instanceof Error ? serviceError.message : t(locale, "recoveryFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleAppControl(action: "stop" | "uninstall") {
    setBusy(`app-${action}`);
    setError(null);
    setNotice(null);

    try {
      const result = action === "stop" ? await stopSlackClawApp() : await uninstallSlackClawApp();
      setNotice(result.message);
      attemptCloseUi();
    } catch (appError) {
      setError(appError instanceof Error ? appError.message : t(locale, "recoveryFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (!overview) {
    return (
      <div className="shell">
        <div className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{t(locale, "appEyebrow")}</p>
            <h1>{t(locale, "heroTitle")}</h1>
            <p className="detail">{t(locale, "heroDetail")}</p>
          </div>
          <div className="hero-status">
            <span className="status-pill warning">{t(locale, "connecting")}</span>
            <p>Connecting to local SlackClaw daemon...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!overview.firstRun.introCompleted) {
    return (
      <div className="shell">
        <div className="hero first-run-hero">
          <div className="hero-copy">
            <p className="eyebrow">{t(locale, "introEyebrow")}</p>
            <h1>{t(locale, "introTitle")}</h1>
            <p className="detail">{t(locale, "introDetail")}</p>
            <div className="action-row">
              <button className="primary" onClick={handleGetStarted} disabled={busy !== null}>
                {busy === "first-run-intro" ? t(locale, "connecting") : t(locale, "getStarted")}
              </button>
              <label className="locale-picker">
                <span>{t(locale, "language")}</span>
                <select value={locale} onChange={(event) => selectLocale(event.target.value as Locale)}>
                  {localeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <article className="install-outcome">
              <strong>{t(locale, "appControlTitle")}</strong>
              <p>{t(locale, "appControlDetail")}</p>
            </article>
            <AppControlButtons locale={locale} busy={busy} onAction={handleAppControl} />
          </div>
          <div className="hero-status">
            <div className="setup-points">
              <article className="install-outcome">
                <strong>1.</strong>
                <p>{t(locale, "introPointOne")}</p>
              </article>
              <article className="install-outcome">
                <strong>2.</strong>
                <p>{t(locale, "introPointTwo")}</p>
              </article>
              <article className="install-outcome">
                <strong>3.</strong>
                <p>{t(locale, "introPointThree")}</p>
              </article>
            </div>
          </div>
        </div>
        {error ? <div className="banner error">{error}</div> : null}
      </div>
    );
  }

  if (!overview.firstRun.setupCompleted) {
    return (
      <div className="shell">
        <div className="hero first-run-hero setup-hero">
          <div className="hero-copy">
            <div className="topbar-row">
              <p className="brand-mark">SlackClaw</p>
              <span className={`status-pill ${installHealthChip(overview).tone}`}>{installHealthChip(overview).label}</span>
            </div>
            <p className="eyebrow">{t(locale, "setupEyebrow")}</p>
            <h1>Run OpenClaw without terminal setup</h1>
            <p className="detail">
              SlackClaw checks your environment and deploys OpenClaw or a compatible managed runtime before guiding the rest of setup.
            </p>
            <div className="action-row">
              <button
                className="primary"
                onClick={() => void handleLocalDeploySetup()}
                disabled={busy !== null}
              >
                {busy === "first-run-local-deploy" ? t(locale, "setupRunning") : t(locale, "deployLocalOpenClaw")}
              </button>
              <button className="ghost" onClick={() => void handleFirstRunSetup()} disabled={busy !== null}>
                {busy === "first-run-setup" ? t(locale, "setupRunning") : t(locale, "setupRetry")}
              </button>
              <label className="locale-picker">
                <span>{t(locale, "language")}</span>
                <select value={locale} onChange={(event) => selectLocale(event.target.value as Locale)}>
                  {localeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="hero-status setup-status">
            <EnvironmentCheckCard overview={overview} locale={locale} />
            {isDeploying ? <LoadingIndicator label={t(locale, "setupRunning")} /> : null}
            <article className="install-outcome">
              <strong>{t(locale, "appControlTitle")}</strong>
              <p>{t(locale, "appControlDetail")}</p>
            </article>
            <AppControlButtons locale={locale} busy={busy} onAction={handleAppControl} />
          </div>
        </div>

        {error ? <div className="banner error">{error}</div> : null}
        {notice ? <div className="banner ok">{notice}</div> : null}

        <main className="grid">
          <section className="panel workspace-panel wizard-panel">
            <SectionHeader
              eyebrow="Setup Wizard"
              title="Deploy first, then continue in SlackClaw"
              detail="This mirrors the design flow: environment check first, deploy OpenClaw second, then onboarding and channels inside the app."
            />
            <div className="setup-steps">
              {setupSteps.length > 0 ? (
                setupSteps.map((step) => (
                  <article key={step.id} className={`setup-step ${step.status}`}>
                    <div className="setup-step-head">
                      <strong>{setupStepTitle(locale, step)}</strong>
                      <SetupStepStatus status={step.status} />
                    </div>
                    <p>{step.detail}</p>
                  </article>
                ))
              ) : (
                <p className="detail">{t(locale, "setupNoSteps")}</p>
              )}
            </div>

            {lastInstall ? (
              <article className="install-outcome">
                <strong>{summarizeInstallDisposition(locale, lastInstall)}</strong>
                <p>{lastInstall.message}</p>
              </article>
            ) : null}
            {isDeploying ? <LoadingIndicator label={t(locale, "deployingDependencies")} /> : null}
          </section>
        </main>
      </div>
    );
  }

  const heroStatusLabel = overview.engine.running ? t(locale, "engineReady") : t(locale, "needsAttention");

  return (
    <div className="shell">
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t(locale, "appEyebrow")}</p>
          <h1>{t(locale, "heroTitle")}</h1>
          <p className="detail">{t(locale, "heroDetail")}</p>
          <div className="action-row">
            <button className="ghost" onClick={() => void loadOverview()} disabled={busy !== null}>
              {t(locale, "refreshStatus")}
            </button>
            <label className="locale-picker">
              <span>{t(locale, "language")}</span>
              <select value={locale} onChange={(event) => selectLocale(event.target.value as Locale)}>
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="hero-status">
          <span className={`status-pill ${overview.engine.running ? "ok" : "warning"}`}>{heroStatusLabel}</span>
          <p>{overview.engine.summary}</p>
          <p className="micro">{t(locale, "platformTarget", { value: overview.platformTarget })}</p>
          {criticalChecks[0] ? (
            <div className="hero-alert">
              <strong>{t(locale, "immediateBlocker")}</strong>
              <p>{criticalChecks[0].summary}</p>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <div className="banner error">{error}</div> : null}
      {notice ? <div className="banner ok">{notice}</div> : null}

      <main className="grid">
        <section className="panel install-panel">
          <SectionHeader
            eyebrow={t(locale, "installEyebrow")}
            title={t(locale, "installTitle")}
            detail={t(locale, "installDetail")}
          />
          <EnvironmentCheckCard overview={overview} locale={locale} />
          <ul className="check-list">
            {overview.installChecks.map((check) => (
              <li key={check.id}>
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </li>
            ))}
          </ul>

          <div className="install-summary">
            <div className="install-kv">
              <span>{t(locale, "pinnedOpenClaw")}</span>
              <strong>{overview.installSpec.desiredVersion}</strong>
            </div>
            <div className="install-kv">
              <span>{t(locale, "detectedVersion")}</span>
              <strong>{overview.engine.version ?? "Not detected"}</strong>
            </div>
            <div className="install-kv">
              <span>{t(locale, "installSource")}</span>
              <strong>{formatInstallSource(locale, overview.installSpec.installSource)}</strong>
            </div>
            {overview.installSpec.installPath ? (
              <div className="install-kv">
                <span>{t(locale, "installPath")}</span>
                <strong>{overview.installSpec.installPath}</strong>
              </div>
            ) : null}
          </div>

          {lastInstall ? (
            <article className="install-outcome">
              <strong>{summarizeInstallDisposition(locale, lastInstall)}</strong>
              <p>{lastInstall.message}</p>
              <span className="micro">
                {t(locale, "installOutcomeExisting", {
                  value: lastInstall.hadExisting ? lastInstall.existingVersion ?? "detected" : "none"
                })}{" "}
                |{" "}
                {t(locale, "installOutcomeActive", {
                  value: lastInstall.actualVersion ?? lastInstall.engineStatus.version ?? "unknown"
                })}
              </span>
            </article>
          ) : null}
          {isDeploying ? <LoadingIndicator label={t(locale, "deployingDependencies")} /> : null}

          <button className="primary" onClick={handleInstall} disabled={busy !== null}>
            {busy === "install" ? t(locale, "installing") : t(locale, "installAndConfigure")}
          </button>
          <button className="ghost" onClick={handleInstallLocal} disabled={busy !== null}>
            {busy === "install-local" ? t(locale, "installing") : t(locale, "deployLocalOpenClaw")}
          </button>
        </section>

        <section className="panel">
          <SectionHeader
            eyebrow={t(locale, "serviceEyebrow")}
            title={t(locale, "serviceTitle")}
            detail={t(locale, "serviceDetail")}
          />
          <div className="install-summary">
            <div className="install-kv">
              <span>{t(locale, "serviceMode")}</span>
              <strong>{overview.appService.mode}</strong>
            </div>
            <div className="install-kv">
              <span>{t(locale, "serviceInstalled")}</span>
              <strong>{overview.appService.installed ? t(locale, "yes") : t(locale, "no")}</strong>
            </div>
            <div className="install-kv">
              <span>{t(locale, "serviceManagedAtLogin")}</span>
              <strong>{overview.appService.managedAtLogin ? t(locale, "yes") : t(locale, "no")}</strong>
            </div>
          </div>
          <article className="install-outcome">
            <strong>{overview.appService.summary}</strong>
            <p>{overview.appService.detail}</p>
          </article>
          <div className="action-row">
            <button className="secondary" onClick={() => void handleServiceAction("install")} disabled={busy !== null}>
              {t(locale, "serviceInstall")}
            </button>
            <button className="ghost" onClick={() => void handleServiceAction("restart")} disabled={busy !== null}>
              {t(locale, "serviceRestart")}
            </button>
            <button className="ghost" onClick={() => void handleServiceAction("uninstall")} disabled={busy !== null}>
              {t(locale, "serviceUninstall")}
            </button>
          </div>
          <article className="install-outcome">
            <strong>{t(locale, "appControlTitle")}</strong>
            <p>{t(locale, "appControlDetail")}</p>
          </article>
          <AppControlButtons locale={locale} busy={busy} onAction={handleAppControl} />
        </section>

        <SetupWizardCard
          locale={locale}
          onboardingCompleted={onboardingCompleted}
          nextChannelId={nextChannelId}
          busy={busy}
          selectedProfileId={selectedProfileId}
          profiles={overview.profiles}
          onSelectProfile={setSelectedProfileId}
          onCompleteOnboarding={handleOnboarding}
          gatewayStarted={overview.channelSetup.gatewayStarted}
        />

        <section className="panel workspace-panel">
          <SectionHeader
            eyebrow={t(locale, "channelEyebrow")}
            title={t(locale, "channelTitle")}
            detail={t(locale, "channelDetail")}
          />
          <article className="install-outcome">
            <strong>{overview.channelSetup.gatewaySummary}</strong>
            <p>
              {overview.channelSetup.baseOnboardingCompleted
                ? t(locale, "baseOnboardingCompleted")
                : t(locale, "baseOnboardingPending")}
            </p>
          </article>
          <div className="health-stack">
            {telegramChannel ? (
              <article className={`health-card ${channelStatusClass(telegramChannel.status)}`}>
                <strong>{telegramChannel.title}</strong>
                <p>{telegramChannel.summary}</p>
                <span className="micro">{telegramChannel.detail}</span>
                {!onboardingCompleted ? (
                  <p className="micro">{t(locale, "baseOnboardingPending")}</p>
                ) : nextChannelId && nextChannelId !== "telegram" && telegramChannel.status !== "completed" ? (
                  <p className="micro">{t(locale, "channelLocked")}</p>
                ) : (
                  <>
                    <label>
                      <span>{t(locale, "telegramTokenLabel")}</span>
                      <input value={telegramToken} onChange={(event) => setTelegramToken(event.target.value)} />
                    </label>
                    <label>
                      <span>{t(locale, "accountNameLabel")}</span>
                      <input value={telegramAccountName} onChange={(event) => setTelegramAccountName(event.target.value)} />
                    </label>
                    <div className="action-row">
                      <button className="secondary" onClick={handleTelegramSetup} disabled={busy !== null}>
                        {busy === "channel-telegram" ? t(locale, "setupRunning") : t(locale, "saveTelegram")}
                      </button>
                    </div>
                    {telegramChannel.status === "awaiting-pairing" || telegramChannel.status === "completed" ? (
                      <>
                        <label>
                          <span>{t(locale, "pairingCodeLabel")}</span>
                          <input value={telegramPairingCode} onChange={(event) => setTelegramPairingCode(event.target.value)} />
                        </label>
                        <button className="ghost" onClick={handleTelegramApprove} disabled={busy !== null}>
                          {busy === "channel-telegram-approve" ? t(locale, "setupRunning") : t(locale, "approveTelegram")}
                        </button>
                      </>
                    ) : null}
                  </>
                )}
              </article>
            ) : null}

            {whatsappChannel ? (
              <article className={`health-card ${channelStatusClass(whatsappChannel.status)}`}>
                <strong>{whatsappChannel.title}</strong>
                <p>{whatsappChannel.summary}</p>
                <span className="micro">{whatsappChannel.detail}</span>
                {whatsappChannel.logs?.length ? <pre>{whatsappChannel.logs.join("\n")}</pre> : null}
                {!onboardingCompleted ? (
                  <p className="micro">{t(locale, "baseOnboardingPending")}</p>
                ) : nextChannelId && nextChannelId !== "whatsapp" && whatsappChannel.status !== "completed" ? (
                  <p className="micro">{t(locale, "channelLocked")}</p>
                ) : (
                  <>
                    <button className="secondary" onClick={handleWhatsappLogin} disabled={busy !== null}>
                      {busy === "channel-whatsapp-login" ? t(locale, "setupRunning") : t(locale, "startWhatsapp")}
                    </button>
                    <label>
                      <span>{t(locale, "pairingCodeLabel")}</span>
                      <input value={whatsappPairingCode} onChange={(event) => setWhatsappPairingCode(event.target.value)} />
                    </label>
                    <button className="ghost" onClick={handleWhatsappApprove} disabled={busy !== null}>
                      {busy === "channel-whatsapp-approve" ? t(locale, "setupRunning") : t(locale, "approveWhatsapp")}
                    </button>
                  </>
                )}
              </article>
            ) : null}

            {wechatChannel ? (
              <article className={`health-card ${channelStatusClass(wechatChannel.status)}`}>
                <strong>{wechatChannel.title}</strong>
                <p>{wechatChannel.summary}</p>
                <span className="micro">{wechatChannel.detail}</span>
                <span className="micro">{t(locale, "wechatExperimental")}</span>
                {!onboardingCompleted ? (
                  <p className="micro">{t(locale, "baseOnboardingPending")}</p>
                ) : nextChannelId && nextChannelId !== "wechat" && wechatChannel.status !== "completed" ? (
                  <p className="micro">{t(locale, "channelLocked")}</p>
                ) : (
                  <>
                    <label>
                      <span>{t(locale, "wechatPluginLabel")}</span>
                      <input value={wechatPluginSpec} onChange={(event) => setWechatPluginSpec(event.target.value)} />
                    </label>
                    <label>
                      <span>{t(locale, "wechatCorpIdLabel")}</span>
                      <input value={wechatCorpId} onChange={(event) => setWechatCorpId(event.target.value)} />
                    </label>
                    <label>
                      <span>{t(locale, "wechatAgentIdLabel")}</span>
                      <input value={wechatAgentId} onChange={(event) => setWechatAgentId(event.target.value)} />
                    </label>
                    <label>
                      <span>{t(locale, "wechatSecretLabel")}</span>
                      <input value={wechatSecret} onChange={(event) => setWechatSecret(event.target.value)} />
                    </label>
                    <label>
                      <span>{t(locale, "wechatTokenLabel")}</span>
                      <input value={wechatToken} onChange={(event) => setWechatToken(event.target.value)} />
                    </label>
                    <label>
                      <span>{t(locale, "wechatEncodingKeyLabel")}</span>
                      <input
                        value={wechatEncodingAesKey}
                        onChange={(event) => setWechatEncodingAesKey(event.target.value)}
                      />
                    </label>
                    <button className="secondary" onClick={handleWechatSetup} disabled={busy !== null}>
                      {busy === "channel-wechat" ? t(locale, "setupRunning") : t(locale, "setupWechat")}
                    </button>
                  </>
                )}
              </article>
            ) : null}
          </div>

          <button
            className="primary"
            onClick={handleChannelGatewayStart}
            disabled={busy !== null || !onboardingCompleted || Boolean(nextChannelId)}
          >
            {busy === "channel-gateway" ? t(locale, "setupRunning") : t(locale, "startGateway")}
          </button>
        </section>

        <ChatConsolePreview
          locale={locale}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          setPrompt={setPrompt}
          templates={overview.templates}
          selectedTemplate={selectedTemplate}
          prompt={prompt}
          onPromptChange={setPrompt}
          workflowReady={workflowReady}
          gatewaySummary={overview.channelSetup.gatewaySummary}
          busy={busy}
          onRun={handleRunTask}
          taskResult={taskResult}
        />

        <section className="panel">
          <SectionHeader
            eyebrow={t(locale, "healthEyebrow")}
            title={t(locale, "healthTitle")}
            detail={t(locale, "healthDetail")}
          />
          {criticalChecks.length > 0 ? (
            <div className="priority-list">
              {criticalChecks.map((check) => (
                <article key={check.id} className={`priority-card ${check.severity}`}>
                  <strong>{check.title}</strong>
                  <p>{check.summary}</p>
                  <span className="micro">{check.detail}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="detail">{t(locale, "noUrgentBlockers")}</p>
          )}

          <div className="health-stack">
            {overview.healthChecks.map((check) => (
              <article key={check.id} className={`health-card ${check.severity}`}>
                <div>
                  <strong>{check.title}</strong>
                  <p>{check.summary}</p>
                </div>
                <span className="micro">{check.detail}</span>
              </article>
            ))}
          </div>
          <div className="action-row">
            <button className="secondary" onClick={handleUpdate} disabled={busy !== null}>
              {busy === "update" ? t(locale, "checkingUpdates") : t(locale, "checkUpdates")}
            </button>
            <button className="ghost" onClick={handleExportDiagnostics} disabled={busy !== null}>
              {busy === "diagnostics" ? t(locale, "exportingDiagnostics") : t(locale, "exportDiagnostics")}
            </button>
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            eyebrow={t(locale, "recoveryEyebrow")}
            title={t(locale, "recoveryTitle")}
            detail={t(locale, "recoveryDetail")}
          />
          <div className="recovery-list">
            {prioritizedRecoveryActions.map((action) => (
              <article key={action.id} className="recovery-card">
                <div>
                  <strong>
                    {action.title}
                    {recommendedRecoveryActions.some((candidate) => candidate.id === action.id)
                      ? ` ${t(locale, "recommended")}`
                      : ""}
                  </strong>
                  <p>{action.description}</p>
                  <span className="micro">{action.expectedImpact}</span>
                </div>
                <button className="ghost" onClick={() => void handleRecovery(action.id)} disabled={busy !== null}>
                  {busy === action.id ? "Running..." : "Run"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            eyebrow={t(locale, "historyEyebrow")}
            title={t(locale, "historyTitle")}
            detail={t(locale, "historyDetail")}
          />
          <div className="history-list">
            {overview.recentTasks.length ? (
              overview.recentTasks.map((task) => (
                <article key={task.taskId} className="history-card">
                  <strong>{task.title}</strong>
                  <p>{task.summary}</p>
                  <span className="micro">{new Date(task.startedAt).toLocaleString()}</span>
                </article>
              ))
            ) : (
              <p className="detail">{t(locale, "noHistory")}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
