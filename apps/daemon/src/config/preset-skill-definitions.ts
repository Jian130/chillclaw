import type { PresetSkillDefinition } from "@slackclaw/contracts";

export const presetSkillDefinitions: PresetSkillDefinition[] = [
  {
    id: "research-brief",
    label: "Research Brief",
    description: "Create concise research summaries with findings, risks, and next steps.",
    onboardingSafe: true,
    runtimeSlug: "research-brief",
    installSource: "bundled",
    bundledAssetPath: "apps/daemon/preset-skills/research-brief/SKILL.md"
  },
  {
    id: "status-writer",
    label: "Status Writer",
    description: "Turn progress into crisp status updates with blockers and recommended follow-ups.",
    onboardingSafe: true,
    runtimeSlug: "status-writer",
    installSource: "bundled",
    bundledAssetPath: "apps/daemon/preset-skills/status-writer/SKILL.md"
  }
];

export function presetSkillDefinitionById(presetSkillId: string): PresetSkillDefinition | undefined {
  return presetSkillDefinitions.find((definition) => definition.id === presetSkillId);
}

export function presetSkillDefinitionByRuntimeSlug(runtimeSlug: string): PresetSkillDefinition | undefined {
  return presetSkillDefinitions.find((definition) => definition.runtimeSlug === runtimeSlug);
}

export function normalizePresetSkillIds(presetSkillIds: string[] | undefined): string[] {
  return [...new Set((presetSkillIds ?? []).map((presetSkillId) => presetSkillId.trim()).filter(Boolean))];
}
