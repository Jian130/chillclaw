import { Brain, Database, Plus, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { useWorkspace } from "../../app/providers/WorkspaceProvider.js";
import { useLocale } from "../../app/providers/LocaleProvider.js";
import { useOverview } from "../../app/providers/OverviewProvider.js";
import { t } from "../../shared/i18n/messages.js";
import { Badge } from "../../shared/ui/Badge.js";
import { Button } from "../../shared/ui/Button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/ui/Card.js";
import { FieldLabel, Input, Select } from "../../shared/ui/Field.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";

const personalities = ["Analytical", "Creative", "Strategic", "Empathetic", "Innovative", "Detail-Oriented"];
const workStyles = ["Methodical", "Fast-Paced", "Data-Driven", "Adaptive", "Structured", "Flexible"];

export default function ChatPage() {
  const { locale } = useLocale();
  const copy = t(locale).chat;
  const { overview } = useOverview();
  const { state, addEmployee, addActivity } = useWorkspace();
  const [name, setName] = useState("Alex Morgan");
  const [title, setTitle] = useState("Senior Research Analyst");
  const [avatarAccent, setAvatarAccent] = useState("var(--avatar-1)");
  const [model, setModel] = useState(state.employees[0]?.model ?? "openai/gpt-4o");
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>(["Analytical", "Detail-Oriented"]);
  const [selectedWorkStyles, setSelectedWorkStyles] = useState<string[]>(["Methodical", "Data-Driven"]);
  const [skills, setSkills] = useState<string[]>(overview?.templates.slice(0, 3).map((template) => template.title) ?? []);

  const availableSkills = useMemo(
    () => overview?.templates.map((template) => template.title) ?? [],
    [overview?.templates]
  );

  function toggle(list: string[], setter: (next: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function handleSkill(skill: string) {
    setSkills((current) =>
      current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]
    );
  }

  function handleSave() {
    const employee = {
      id: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name,
      title,
      status: "ready" as const,
      activeTasks: 0,
      currentStatus: "Ready for new assignments",
      model,
      personalities: selectedPersonalities,
      workStyles: selectedWorkStyles,
      skills,
      avatarAccent
    };
    addEmployee(employee);
    addActivity({
      id: `activity-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      action: "Created Digital Employee",
      description: `${employee.title} is ready to be assigned from SlackClaw.`,
      timestamp: "Just now",
      tone: "assigned"
    });
  }

  return (
    <div className="panel-stack">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <div className="employee-builder">
        <Card>
          <CardHeader>
            <CardTitle>{copy.identity}</CardTitle>
          </CardHeader>
          <CardContent className="panel-stack">
            <div className="avatar-frame" style={{ background: avatarAccent }}>
              {name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
            </div>
            <div className="avatar-strip">
              {["var(--avatar-1)", "var(--avatar-2)", "var(--avatar-3)", "var(--avatar-4)", "var(--avatar-5)"].map((accent) => (
                <button
                  className={avatarAccent === accent ? "active" : ""}
                  key={accent}
                  onClick={() => setAvatarAccent(accent)}
                  style={{ background: accent }}
                  type="button"
                />
              ))}
            </div>
            <div className="field-grid">
              <div>
                <FieldLabel htmlFor="employee-name">Employee Name</FieldLabel>
                <Input id="employee-name" onChange={(event) => setName(event.target.value)} value={name} />
              </div>
              <div>
                <FieldLabel htmlFor="employee-title">Job Title</FieldLabel>
                <Input id="employee-title" onChange={(event) => setTitle(event.target.value)} value={title} />
              </div>
              <div>
                <FieldLabel>Personality</FieldLabel>
                <div className="personality-grid">
                  {personalities.map((item) => (
                    <button className="badge badge--neutral" key={item} onClick={() => toggle(selectedPersonalities, setSelectedPersonalities, item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Work Style</FieldLabel>
                <div className="personality-grid">
                  {workStyles.map((item) => (
                    <button className="badge badge--info" key={item} onClick={() => toggle(selectedWorkStyles, setSelectedWorkStyles, item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.brain}</CardTitle>
          </CardHeader>
          <CardContent className="panel-stack">
            <div>
              <FieldLabel htmlFor="primary-model">Primary AI Model</FieldLabel>
              <Select id="primary-model" onChange={(event) => setModel(event.target.value)} value={model}>
                {Array.from(new Set(state.employees.map((employee) => employee.model))).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid--two">
              <Card>
                <CardContent className="actions-row">
                  <Brain size={18} />
                  <div>
                    <strong>Memory</strong>
                    <p className="card__description">Always active</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="actions-row">
                  <Sparkles size={18} />
                  <div>
                    <strong>Context</strong>
                    <p className="card__description">Always active</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="dropzone">
              <strong>Equipped skills</strong>
              <div className="skill-chip-grid" style={{ marginTop: 12 }}>
                {skills.map((skill) => (
                  <Badge key={skill} tone="info">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <Card>
              <CardContent className="actions-row">
                <Database size={18} />
                <div>
                  <strong>Connect knowledge base</strong>
                  <p className="card__description">Optional enhancement</p>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.library}</CardTitle>
          </CardHeader>
          <CardContent className="panel-stack">
            <div className="skill-grid">
              {availableSkills.map((skill) => (
                <button className="skill-card" key={skill} onClick={() => handleSkill(skill)} type="button">
                  <div className="actions-row" style={{ justifyContent: "space-between" }}>
                    <div className="actions-row">
                      <div className="provider-logo">
                        <Zap size={18} />
                      </div>
                      <div className="provider-details">
                        <strong>{skill}</strong>
                        <span className="card__description">Preloaded SlackClaw template</span>
                      </div>
                    </div>
                    <Badge tone={skills.includes(skill) ? "success" : "neutral"}>
                      {skills.includes(skill) ? "Equipped" : "Add"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="actions-row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>Ready to deploy {name}?</strong>
            <p className="card__description">
              {skills.length} skills equipped · {selectedPersonalities.join(", ")}
            </p>
          </div>
          <div className="actions-row">
            <Button variant="outline">
              <Plus size={14} />
              {copy.saveDraft}
            </Button>
            <Button onClick={handleSave}>
              <Sparkles size={14} />
              {copy.deployEmployee}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
