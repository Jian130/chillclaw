import { Search, Settings2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { useWorkspace } from "../../app/providers/WorkspaceProvider.js";
import { useOverview } from "../../app/providers/OverviewProvider.js";
import { useLocale } from "../../app/providers/LocaleProvider.js";
import { t } from "../../shared/i18n/messages.js";
import { Badge } from "../../shared/ui/Badge.js";
import { Button } from "../../shared/ui/Button.js";
import { Dialog } from "../../shared/ui/Dialog.js";
import { FieldLabel, Input, Textarea } from "../../shared/ui/Field.js";
import { MetricCard } from "../../shared/ui/MetricCard.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../shared/ui/Tabs.js";

export default function SkillsPage() {
  const { locale } = useLocale();
  const copy = t(locale).skills;
  const { overview } = useOverview();
  const { state, update, saveSkillDraft } = useWorkspace();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCategory, setDraftCategory] = useState("");

  const preloaded = overview?.templates ?? [];
  const filtered = useMemo(
    () =>
      preloaded.filter(
        (template) =>
          template.title.toLowerCase().includes(search.toLowerCase()) ||
          template.description.toLowerCase().includes(search.toLowerCase())
      ),
    [preloaded, search]
  );

  function toggleSkill(id: string) {
    update((current) => ({
      ...current,
      skillEnabledIds: current.skillEnabledIds.includes(id)
        ? current.skillEnabledIds.filter((item) => item !== id)
        : [...current.skillEnabledIds, id]
    }));
  }

  function saveDraft() {
    const id = `${draftName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    saveSkillDraft({ id, name: draftName, description: draftDescription, category: draftCategory, enabled: true });
    setDraftName("");
    setDraftDescription("");
    setDraftCategory("");
    setDialogOpen(false);
  }

  return (
    <div className="panel-stack">
      <PageHeader
        actions={
          <Button onClick={() => setDialogOpen(true)} variant="outline">
            <Sparkles size={14} />
            {copy.addCustom}
          </Button>
        }
        subtitle={copy.subtitle}
        title={copy.title}
      />

      <div className="grid--four">
        <MetricCard label={copy.total} value={preloaded.length} />
        <MetricCard label={copy.enabled} value={state.skillEnabledIds.length} />
        <MetricCard label={copy.preloaded} value={preloaded.length} />
        <MetricCard label={copy.custom} value={state.customSkillDrafts.length} />
      </div>

      <div className="actions-row">
        <label className="language-selector" style={{ minWidth: 320 }}>
          <Search size={16} />
          <Input onChange={(event) => setSearch(event.target.value)} placeholder="Search skills..." value={search} />
        </label>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Skills ({filtered.length})</TabsTrigger>
          <TabsTrigger value="enabled">Enabled ({filtered.filter((item) => state.skillEnabledIds.includes(item.id)).length})</TabsTrigger>
          <TabsTrigger value="disabled">Disabled ({filtered.filter((item) => !state.skillEnabledIds.includes(item.id)).length})</TabsTrigger>
        </TabsList>
        {["all", "enabled", "disabled"].map((tab) => (
          <TabsContent className="skill-grid" key={tab} value={tab}>
            {filtered
              .filter((template) => {
                if (tab === "enabled") return state.skillEnabledIds.includes(template.id);
                if (tab === "disabled") return !state.skillEnabledIds.includes(template.id);
                return true;
              })
              .map((template) => (
                <div className="skill-card" key={template.id}>
                  <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "start" }}>
                    <div className="actions-row">
                      <div className="provider-logo">{template.title.slice(0, 2).toUpperCase()}</div>
                      <div className="provider-details">
                        <strong>{template.title}</strong>
                        <span className="card__description">{template.description}</span>
                      </div>
                    </div>
                    <Badge tone={state.skillEnabledIds.includes(template.id) ? "success" : "neutral"}>
                      {state.skillEnabledIds.includes(template.id) ? copy.enabled : copy.disabled}
                    </Badge>
                  </div>
                  <div className="actions-row" style={{ marginTop: 16, justifyContent: "space-between" }}>
                    <Badge tone="neutral">{template.category}</Badge>
                    <div className="actions-row">
                      <Button onClick={() => toggleSkill(template.id)} variant="outline">
                        <Settings2 size={14} />
                        {state.skillEnabledIds.includes(template.id) ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog description="Create a local custom skill draft in SlackClaw." onClose={() => setDialogOpen(false)} open={dialogOpen} title="Create Custom Skill">
        <div className="field-grid">
          <div>
            <FieldLabel htmlFor="draft-name">Skill name</FieldLabel>
            <Input id="draft-name" onChange={(event) => setDraftName(event.target.value)} value={draftName} />
          </div>
          <div>
            <FieldLabel htmlFor="draft-category">Category</FieldLabel>
            <Input id="draft-category" onChange={(event) => setDraftCategory(event.target.value)} value={draftCategory} />
          </div>
          <div>
            <FieldLabel htmlFor="draft-description">Description</FieldLabel>
            <Textarea id="draft-description" onChange={(event) => setDraftDescription(event.target.value)} value={draftDescription} />
          </div>
          <Button onClick={saveDraft}>{copy.addCustom}</Button>
        </div>
      </Dialog>
    </div>
  );
}
