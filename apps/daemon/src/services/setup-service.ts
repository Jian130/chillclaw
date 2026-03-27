import { randomUUID } from "node:crypto";

import type {
  InstallResponse,
  SetupRunResponse,
  SetupStepResult
} from "@slackclaw/contracts";

import type { EngineAdapter } from "../engine/adapter.js";
import { EventPublisher } from "./event-publisher.js";
import { OverviewService } from "./overview-service.js";
import { PresetSkillService } from "./preset-skill-service.js";
import { StateStore } from "./state-store.js";

export class SetupService {
  constructor(
    private readonly adapter: EngineAdapter,
    private readonly store: StateStore,
    private readonly overviewService: OverviewService,
    private readonly eventPublisher?: EventPublisher,
    private readonly presetSkillService?: PresetSkillService
  ) {}

  async markIntroCompleted() {
    await this.store.update((current) => ({
      ...current,
      introCompletedAt: current.introCompletedAt ?? new Date().toISOString()
    }));

    return this.overviewService.getOverview();
  }

  async runFirstRunSetup(options?: { forceLocal?: boolean }): Promise<SetupRunResponse> {
    const correlationId = `first-run-setup:${randomUUID()}`;
    const steps: SetupStepResult[] = [];
    let installResult: InstallResponse | undefined;

    await this.store.update((current) => ({
      ...current,
      introCompletedAt: current.introCompletedAt ?? new Date().toISOString()
    }));

    const statusBefore = await this.adapter.instances.status();
    this.eventPublisher?.publishDeployProgress({
      correlationId,
      targetId: "managed-local",
      phase: statusBefore.installed ? "reusing" : "detecting",
      percent: 10,
      message: statusBefore.installed
        ? `Found OpenClaw ${statusBefore.version ?? "installed"} and SlackClaw is preparing to reuse it.`
        : "SlackClaw is preparing a managed local OpenClaw install for this Mac."
    });
    steps.push({
      id: "check-existing-openclaw",
      title: "Check for an existing OpenClaw installation",
      status: "completed",
      detail: statusBefore.installed
        ? `Found OpenClaw ${statusBefore.version ?? "installed"} on this Mac and SlackClaw can try to reuse it.`
        : "No compatible OpenClaw installation was found yet. SlackClaw will deploy a managed local copy for this user."
    });

    installResult = await this.adapter.instances.install(false, { forceLocal: options?.forceLocal ?? false });
    this.eventPublisher?.publishDeployCompleted({
      correlationId,
      targetId: "managed-local",
      status: installResult.status === "installed" || installResult.status === "already-installed" ? "completed" : "failed",
      message: installResult.message,
      engineStatus: installResult.engineStatus
    });
    steps.push({
      id: "prepare-openclaw",
      title: "Prepare OpenClaw and its required dependencies",
      status: installResult.status === "installed" || installResult.status === "already-installed" ? "completed" : "failed",
      detail: installResult.message
    });

    const onboardingDraft = (await this.store.read()).onboarding?.draft;
    const presetSkillIds = onboardingDraft?.employee?.presetSkillIds ?? [];
    if (this.presetSkillService && presetSkillIds.length > 0) {
      const targetMode =
        onboardingDraft?.install?.disposition === "reused-existing" || onboardingDraft?.install?.disposition === "installed-system"
          ? "reused-install"
          : "managed-local";
      const presetSkillSync = await this.presetSkillService.setDesiredPresetSkillIds("onboarding", presetSkillIds, {
        targetMode
      });
      const failedPresetSync = presetSkillSync.entries.find((entry) => entry.status === "failed");
      steps.push({
        id: "install-preset-skills",
        title: "Install preset skills into OpenClaw",
        status: failedPresetSync ? "failed" : "completed",
        detail: failedPresetSync?.lastError ?? presetSkillSync.summary
      });
    }

    const overview = await this.overviewService.getOverview();
    const failedStep = steps.find((step) => step.status === "failed");

    return {
      status: failedStep ? "failed" : "completed",
      message: failedStep
        ? "SlackClaw finished part of setup, but OpenClaw still needs attention."
        : "OpenClaw deployment is complete. Continue to Configuration for models and channels.",
      steps,
      overview,
      install: installResult
    };
  }
}
