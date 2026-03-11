import { Activity, ArrowRight, Brain, CheckCircle2, Shield, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { useWorkspace } from "../../app/providers/WorkspaceProvider.js";
import { useOverview } from "../../app/providers/OverviewProvider.js";
import { useLocale } from "../../app/providers/LocaleProvider.js";
import { t } from "../../shared/i18n/messages.js";
import { Badge } from "../../shared/ui/Badge.js";
import { Button } from "../../shared/ui/Button.js";
import { Card, CardContent } from "../../shared/ui/Card.js";
import { MetricCard } from "../../shared/ui/MetricCard.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";

function toneColor(tone: string) {
  if (tone === "completed") return "#16a34a";
  if (tone === "started") return "#2563eb";
  if (tone === "generated") return "#7c3aed";
  if (tone === "updated") return "#d97706";
  return "#4f46e5";
}

export default function DashboardPage() {
  const { locale } = useLocale();
  const copy = t(locale).dashboard;
  const { overview } = useOverview();
  const { state } = useWorkspace();
  const readyCount = state.employees.filter((employee) => employee.status === "ready").length;
  const busyCount = state.employees.filter((employee) => employee.status === "busy").length;
  const channelReady = overview?.channelSetup.channels.filter((channel) => channel.status === "completed" || channel.status === "ready").length ?? 0;

  return (
    <div className="panel-stack">
      <PageHeader
        actions={
          <>
            <Link to="/chat">
              <Button size="lg">
                <Users size={16} />
                {copy.createEmployee}
              </Button>
            </Link>
            <Link to="/team">
              <Button size="lg" variant="outline">
                {copy.openTeam}
              </Button>
            </Link>
          </>
        }
        subtitle={copy.subtitle}
        title={copy.title}
      />

      <div className="hero-banner">
        <div className="actions-row" style={{ marginBottom: 14 }}>
          <Badge tone="info">
            <Sparkles size={14} />
            Powered by OpenClaw
          </Badge>
          <Badge tone="success">
            <CheckCircle2 size={14} />
            Workspace active
          </Badge>
          <Badge tone="neutral">
            <Brain size={14} />
            {overview?.engine.version ?? overview?.installSpec.desiredVersion}
          </Badge>
        </div>
        <h2>Figma shell, backend-truthful state</h2>
        <p>The layout follows the new main-file dashboard while the metrics come from the daemon and the digital employee roster stays local to SlackClaw.</p>
      </div>

      <div className="grid--metrics">
        <MetricCard detail={overview?.engine.summary} label="Engine" value={overview?.engine.installed ? "Installed" : "Missing"} />
        <MetricCard detail={overview?.installSpec.desiredVersion} label="Connected Models" value={overview?.installChecks.length ?? 0} />
        <MetricCard detail={`${readyCount} ready / ${busyCount} busy`} label="Digital Employees" value={state.employees.length} />
        <MetricCard detail="In Progress" label="Active Tasks" value={state.employees.reduce((total, employee) => total + employee.activeTasks, 0)} />
        <MetricCard detail={overview?.channelSetup.gatewaySummary} label="Channels Ready" value={channelReady} />
      </div>

      <div className="split-layout">
        <Card>
          <CardContent className="panel-stack">
            <div className="actions-row" style={{ justifyContent: "space-between" }}>
              <strong>{copy.employeeStatus}</strong>
              <Link to="/team">
                <Button variant="ghost">
                  View all
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
            <div className="employee-grid">
              {state.employees.map((employee) => (
                <div className="employee-card" key={employee.id}>
                  <div className="actions-row" style={{ gap: 16, alignItems: "center" }}>
                    <div className="employee-card__avatar" style={{ background: employee.avatarAccent, width: 72, minWidth: 72, aspectRatio: "1" }}>
                      {employee.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                    <div className="employee-details">
                      <strong>{employee.name}</strong>
                      <span className="card__description">{employee.title}</span>
                      <div className="actions-row">
                        <Badge tone={employee.status === "ready" ? "success" : employee.status === "busy" ? "info" : "neutral"}>
                          {employee.status}
                        </Badge>
                        {employee.activeTasks ? <Badge tone="neutral">{employee.activeTasks} active</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <p className="card__description" style={{ marginTop: 12 }}>{employee.currentStatus}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="panel-stack">
          <Card>
            <CardContent className="panel-stack">
              <div className="actions-row">
                <Activity size={18} />
                <strong>{copy.recentActivity}</strong>
              </div>
              <div className="activity-list">
                {state.activity.map((item) => (
                  <div className="check-row" key={item.id}>
                    <div className="actions-row" style={{ alignItems: "start" }}>
                      <div className="channel-logo" style={{ background: toneColor(item.tone), color: "white" }}>
                        {item.employeeName[0]}
                      </div>
                      <div className="check-row__meta">
                        <strong>{item.action}</strong>
                        <p>{item.description}</p>
                        <p>{item.employeeName} · {item.timestamp}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="panel-stack">
              <div className="actions-row">
                <Shield size={18} />
                <strong>{copy.workspaceHealth}</strong>
              </div>
              <div className="status-list">
                <div className="check-row"><strong>OpenClaw deployed</strong><Badge tone={overview?.engine.installed ? "success" : "warning"}>{overview?.engine.installed ? "Active" : "Missing"}</Badge></div>
                <div className="check-row"><strong>Gateway reachable</strong><Badge tone={overview?.engine.running ? "success" : "warning"}>{overview?.engine.running ? "Running" : "Stopped"}</Badge></div>
                <div className="check-row"><strong>Channels configured</strong><Badge tone={channelReady ? "success" : "warning"}>{channelReady ? `${channelReady} ready` : "Pending"}</Badge></div>
                <div className="check-row"><strong>Health blockers</strong><Badge tone={overview?.healthChecks.some((check) => check.severity === "error") ? "warning" : "success"}>{overview?.healthChecks.some((check) => check.severity === "error") ? "Review" : "Clear"}</Badge></div>
                <div className="check-row"><strong>Digital employee roster</strong><Badge tone="info">{state.employees.length} employees</Badge></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
