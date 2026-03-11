import { ArrowRight, MessageSquare, Plus, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { useWorkspace } from "../../app/providers/WorkspaceProvider.js";
import { useLocale } from "../../app/providers/LocaleProvider.js";
import { t } from "../../shared/i18n/messages.js";
import { Badge } from "../../shared/ui/Badge.js";
import { Button } from "../../shared/ui/Button.js";
import { Card, CardContent } from "../../shared/ui/Card.js";
import { Input } from "../../shared/ui/Field.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";

export default function TeamPage() {
  const { locale } = useLocale();
  const copy = t(locale).team;
  const { state } = useWorkspace();
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">("chat");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [draft, setDraft] = useState("");

  const selectedEmployee = state.employees.find((employee) => employee.id === selectedEmployeeId) ?? state.employees[0];
  const filteredEmployees = useMemo(
    () =>
      state.employees.filter(
        (employee) =>
          employee.name.toLowerCase().includes(search.toLowerCase()) ||
          employee.title.toLowerCase().includes(search.toLowerCase())
      ),
    [search, state.employees]
  );

  function sendMessage() {
    if (!draft.trim() || !selectedEmployee) return;
    setMessages((current) => [
      ...current,
      { role: "user", content: draft.trim() },
      { role: "assistant", content: `Got it. ${selectedEmployee.name} will handle: ${draft.trim()}` }
    ]);
    setDraft("");
  }

  return (
    <div className="panel-stack">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <Card>
        <CardContent className="actions-row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>{copy.vision}</strong>
            <p className="card__description">{state.teamVision}</p>
          </div>
          <Button variant="outline">
            <Sparkles size={14} />
            Edit Vision
          </Button>
        </CardContent>
      </Card>

      <div className="actions-row">
        <label className="language-selector" style={{ minWidth: 320 }}>
          <Search size={16} />
          <Input onChange={(event) => setSearch(event.target.value)} placeholder="Search employees by name or role..." value={search} />
        </label>
        <Button>
          <Plus size={14} />
          {copy.createEmployee}
        </Button>
      </div>

      <div className="split-layout">
        <div className="employee-grid">
          {filteredEmployees.map((employee) => (
            <button className="employee-card" key={employee.id} onClick={() => setSelectedEmployeeId(employee.id)} type="button">
              <div className="employee-card__avatar" style={{ background: employee.avatarAccent }}>{employee.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
              <div className="employee-details">
                <strong>{employee.name}</strong>
                <span className="card__description">{employee.title}</span>
                <div className="actions-row">
                  <Badge tone={employee.status === "ready" ? "success" : employee.status === "busy" ? "info" : "neutral"}>
                    {employee.status}
                  </Badge>
                  {employee.activeTasks ? <Badge tone="neutral">{employee.activeTasks} active</Badge> : null}
                </div>
                <div className="skill-chip-grid">
                  {employee.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill} tone="neutral">
                      {skill}
                    </Badge>
                  ))}
                </div>
                <div className="actions-row" style={{ color: "var(--primary)" }}>
                  <MessageSquare size={14} />
                  <span>Chat & Assign Tasks</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="panel-stack">
            <div className="actions-row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{selectedEmployee?.name}</strong>
                <p className="card__description">{selectedEmployee?.title}</p>
              </div>
              <div className="actions-row">
                <Button onClick={() => setActiveTab("chat")} variant={activeTab === "chat" ? "primary" : "outline"}>
                  {copy.chat}
                </Button>
                <Button onClick={() => setActiveTab("tasks")} variant={activeTab === "tasks" ? "primary" : "outline"}>
                  {copy.tasks}
                </Button>
              </div>
            </div>

            {activeTab === "chat" ? (
              <div className="panel-stack">
                <div className="message-list">
                  {messages.length ? (
                    messages.map((message, index) => (
                      <div className={`message-bubble message-bubble--${message.role === "user" ? "user" : "assistant"}`} key={`${message.role}-${index}`}>
                        {message.content}
                      </div>
                    ))
                  ) : (
                    <p className="card__description">Start the conversation with a quick assignment.</p>
                  )}
                </div>
                <div className="actions-row">
                  <Input onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${selectedEmployee?.name ?? "employee"}...`} value={draft} />
                  <Button onClick={sendMessage}>Send</Button>
                </div>
              </div>
            ) : (
              <div className="panel-stack">
                <div className="check-row">
                  <div className="check-row__meta">
                    <strong>Current tasks</strong>
                    <p>{selectedEmployee?.activeTasks ?? 0} tasks in progress</p>
                  </div>
                  <Badge tone="info">{selectedEmployee?.activeTasks ?? 0}</Badge>
                </div>
                <div className="check-row">
                  <div className="check-row__meta">
                    <strong>Assigned model</strong>
                    <p>{selectedEmployee?.model}</p>
                  </div>
                  <Badge tone="neutral">Brain</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
