import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Container,
  Loader2,
  Rocket,
  Zap
} from "lucide-react";

import { runFirstRunSetup } from "../../shared/api/client.js";
import { useLocale } from "../../app/providers/LocaleProvider.js";
import { useOverview } from "../../app/providers/OverviewProvider.js";
import { t } from "../../shared/i18n/messages.js";
import { Button } from "../../shared/ui/Button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../shared/ui/Card.js";
import { Badge } from "../../shared/ui/Badge.js";
import { Progress } from "../../shared/ui/Progress.js";

type VariantId = "standard" | "managed-local" | "zeroclaw" | "ironclaw";

const variants: Array<{
  id: VariantId;
  name: string;
  description: string;
  icon: string;
  recommended?: boolean;
  planned?: boolean;
  gradientClass: string;
  hoverBorderClass: string;
  iconClass: string;
  features: string[];
  requirements: {
    memory: string;
    disk: string;
    runtime: string;
  };
}> = [
  {
    id: "standard",
    name: "OpenClaw Standard",
    description: "Reuse the installed OpenClaw when it already matches SlackClaw.",
    icon: "🦞",
    recommended: true,
    gradientClass: "deploy-variant--standard",
    hoverBorderClass: "deploy-variant--blue",
    iconClass: "deploy-variant__icon--blue",
    features: [
      "Reuses compatible OpenClaw installs",
      "Keeps existing OpenClaw settings",
      "Fastest path to first deploy",
      "Uses the real SlackClaw setup flow"
    ],
    requirements: {
      memory: "4GB RAM",
      disk: "10GB",
      runtime: "System install"
    }
  },
  {
    id: "managed-local",
    name: "OpenClaw Managed Local",
    description: "Deploy OpenClaw into SlackClaw’s managed runtime folder.",
    icon: "🦞",
    gradientClass: "deploy-variant--green",
    hoverBorderClass: "deploy-variant--green-hover",
    iconClass: "deploy-variant__icon--green",
    features: [
      "Keeps engine files inside SlackClaw data",
      "Cleaner isolation for desktop installs",
      "Pinned SlackClaw-managed version",
      "Uses the real SlackClaw setup flow"
    ],
    requirements: {
      memory: "4GB RAM",
      disk: "10GB",
      runtime: "Managed local"
    }
  },
  {
    id: "zeroclaw",
    name: "ZeroClaw",
    description: "Future engine adapter target with the same SlackClaw UI flow.",
    icon: "🦞",
    planned: true,
    gradientClass: "deploy-variant--purple",
    hoverBorderClass: "deploy-variant--purple-hover",
    iconClass: "deploy-variant__icon--purple",
    features: [
      "Reserved future engine slot",
      "Planned adapter-backed install path",
      "Same onboarding and config UX",
      "Not available in v0.1"
    ],
    requirements: {
      memory: "Planned",
      disk: "Planned",
      runtime: "Coming soon"
    }
  },
  {
    id: "ironclaw",
    name: "IronClaw",
    description: "Future engine adapter target for a later SlackClaw release.",
    icon: "🦞",
    planned: true,
    gradientClass: "deploy-variant--orange",
    hoverBorderClass: "deploy-variant--orange-hover",
    iconClass: "deploy-variant__icon--orange",
    features: [
      "Reserved future engine slot",
      "Adapter-ready product architecture",
      "Same deploy and config surfaces",
      "Not available in v0.1"
    ],
    requirements: {
      memory: "Planned",
      disk: "Planned",
      runtime: "Coming soon"
    }
  }
];

const stagedProgress = [
  { label: "Checking existing OpenClaw installation...", value: 20 },
  { label: "Preparing deployment environment...", value: 40 },
  { label: "Configuring SlackClaw runtime...", value: 60 },
  { label: "Verifying OpenClaw installation...", value: 80 }
];

export default function DeployPage() {
  const { locale } = useLocale();
  const copy = t(locale).deploy;
  const common = t(locale).common;
  const { overview, refresh } = useOverview();
  const [selectedVariant, setSelectedVariant] = useState<VariantId | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deploymentStage, setDeploymentStage] = useState("");
  const [message, setMessage] = useState("");

  const selectedVariantName = useMemo(
    () => variants.find((variant) => variant.id === selectedVariant)?.name,
    [selectedVariant]
  );

  async function handleDeploy() {
    if (!selectedVariant || selectedVariant === "zeroclaw" || selectedVariant === "ironclaw") {
      return;
    }

    setDeploying(true);
    setDeployProgress(0);
    setDeploymentStage(stagedProgress[0].label);
    setMessage("");

    let stageIndex = 0;
    const progressTimer = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, stagedProgress.length - 1);
      setDeploymentStage(stagedProgress[stageIndex].label);
      setDeployProgress(stagedProgress[stageIndex].value);
    }, 1200);

    try {
      const result = await runFirstRunSetup(selectedVariant === "managed-local");
      clearInterval(progressTimer);
      setDeployProgress(100);
      setDeploymentStage(result.message);
      setMessage(result.message);
      await refresh();
    } finally {
      clearInterval(progressTimer);
      setDeploying(false);
    }
  }

  return (
    <div className="deploy-page">
      <div className="deploy-header">
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </div>

      {deploying ? (
        <Card className="deploy-progress-card">
          <CardContent className="deploy-progress-card__content">
            <div className="deploy-progress-card__row">
              <Loader2 className="deploy-progress-card__spinner" size={24} />
              <div className="deploy-progress-card__meta">
                <h3>{copy.deploying}</h3>
                <p>{deploymentStage}</p>
              </div>
              <span className="deploy-progress-card__value">{deployProgress}%</span>
            </div>
            <Progress value={deployProgress} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="deploy-info-card">
        <CardContent className="deploy-info-card__content">
          <div className="deploy-info-card__icon">
            <Rocket size={24} />
          </div>
          <div className="deploy-info-card__copy">
            <h3>One-Click Deployment</h3>
            <p>
              Select your preferred OpenClaw variant and deploy instantly. No terminal commands or
              manual configuration required.
            </p>
            <div className="deploy-info-card__checks">
              <div>
                <CheckCircle2 size={16} />
                <span>Automatic setup</span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>Local-first workflow</span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>Pre-configured defaults</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="deploy-variant-grid">
        {variants.map((variant) => {
          const selected = selectedVariant === variant.id;
          return (
            <Card
              className={[
                "deploy-variant-card",
                variant.gradientClass,
                selected ? "deploy-variant-card--selected" : "",
                !selected ? variant.hoverBorderClass : "",
                variant.planned ? "deploy-variant-card--planned" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={variant.id}
              onClick={() => {
                if (!variant.planned) {
                  setSelectedVariant(variant.id);
                }
              }}
              role="button"
              tabIndex={variant.planned ? -1 : 0}
            >
              <CardHeader>
                <div className="deploy-variant-card__header">
                  <div className="deploy-variant-card__identity">
                    <div className={`deploy-variant__icon ${variant.iconClass}`}>
                      <span>{variant.icon}</span>
                    </div>
                    <div>
                      <CardTitle>{variant.name}</CardTitle>
                      <CardDescription className="deploy-variant-card__description">
                        {variant.description}
                      </CardDescription>
                    </div>
                  </div>
                  {variant.recommended ? (
                    <Badge className="deploy-badge deploy-badge--recommended">Recommended</Badge>
                  ) : null}
                  {variant.planned ? (
                    <Badge className="deploy-badge deploy-badge--planned">{common.comingSoon}</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <div className="deploy-variant-card__body">
                  <div>
                    <h4>Features</h4>
                    <ul className="deploy-feature-list">
                      {variant.features.map((feature) => (
                        <li key={feature}>
                          <CheckCircle2 size={16} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="deploy-requirements">
                    <h4>Requirements</h4>
                    <div className="deploy-requirements__grid">
                      <div>
                        <p>Memory</p>
                        <strong>{variant.requirements.memory}</strong>
                      </div>
                      <div>
                        <p>Disk</p>
                        <strong>{variant.requirements.disk}</strong>
                      </div>
                      <div>
                        <p>Runtime</p>
                        <strong>{variant.requirements.runtime}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="deploy-cta-card">
        <CardContent className="deploy-cta-card__content">
          <div>
            <h3>Ready to deploy?</h3>
            <p>
              {selectedVariantName
                ? `You've selected ${selectedVariantName}`
                : "Select a variant to get started"}
            </p>
            {message ? <p className="deploy-cta-card__message">{message}</p> : null}
            {!message && overview?.firstRun.setupCompleted ? (
              <p className="deploy-cta-card__message">{copy.completion}</p>
            ) : null}
          </div>
          <Button
            className="deploy-cta-button"
            disabled={!selectedVariant || deploying || selectedVariant === "zeroclaw" || selectedVariant === "ironclaw"}
            onClick={handleDeploy}
            size="lg"
          >
            {deploying ? (
              <>
                <Loader2 className="deploy-cta-button__spinner" size={20} />
                {copy.deploying}
              </>
            ) : (
              <>
                <Rocket size={20} />
                {copy.deployNow}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="deploy-summary-grid">
        <Card>
          <CardContent className="deploy-summary-card">
            <Container className="deploy-summary-card__icon deploy-summary-card__icon--blue" size={20} />
            <div>
              <h4>Local Runtime</h4>
              <p>Runs locally so users stay in a clear, self-contained desktop flow.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="deploy-summary-card">
            <Zap className="deploy-summary-card__icon deploy-summary-card__icon--green" size={20} />
            <div>
              <h4>Fast Setup</h4>
              <p>SlackClaw checks, reuses, or deploys OpenClaw with one primary action.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="deploy-summary-card">
            <AlertCircle className="deploy-summary-card__icon deploy-summary-card__icon--purple" size={20} />
            <div>
              <h4>Safe &amp; Clear</h4>
              <p>Deployment stops at install. Onboarding and channel configuration happen next.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
