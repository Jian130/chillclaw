import type { AIMemberPreset, SkillOption } from "@slackclaw/contracts";

import { presetSkillDefinitions } from "./preset-skill-definitions.js";

export const defaultAIMemberSkillOptions: SkillOption[] = [
  {
    id: "research-brief",
    label: "Research Brief",
    description: "Create concise research summaries with findings, risks, and next steps."
  },
  {
    id: "status-writer",
    label: "Status Writer",
    description: "Turn progress into crisp status updates with blockers and recommended follow-ups."
  }
];

export const aiMemberPresets: AIMemberPreset[] = [
  {
    id: "general-assistant",
    label: "General Assistant",
    description: "Start with a dependable default setup for everyday requests, summaries, and follow-ups.",
    avatarPresetId: "operator",
    jobTitle: "General Assistant",
    personality: "Clear, practical, and dependable",
    soul: "Turn requests into useful next steps without adding extra complexity.",
    workStyles: ["Methodical", "Structured"],
    presetSkillIds: presetSkillDefinitions.map((definition) => definition.id),
    skillIds: ["research-brief", "status-writer"],
    knowledgePackIds: ["company-handbook", "delivery-playbook"],
    defaultMemoryEnabled: true
  },
  {
    id: "research-analyst",
    label: "Research Analyst",
    description: "Bias this member toward grounded research, synthesis, and concise recommendations.",
    avatarPresetId: "analyst",
    jobTitle: "Research Analyst",
    personality: "Analytical, calm, and evidence-driven",
    soul: "Separate signal from noise and turn findings into crisp recommendations.",
    workStyles: ["Data-driven", "Methodical"],
    presetSkillIds: ["research-brief", "status-writer"],
    skillIds: ["research-brief", "status-writer"],
    knowledgePackIds: ["company-handbook"],
    defaultMemoryEnabled: true
  },
  {
    id: "ops-coordinator",
    label: "Ops Coordinator",
    description: "Favor fast status updates, structured execution, and recovery-oriented communication.",
    avatarPresetId: "builder",
    jobTitle: "Operations Coordinator",
    personality: "Organized, proactive, and steady under pressure",
    soul: "Keep work moving, surface blockers early, and make the next step obvious.",
    workStyles: ["Structured", "Fast-paced"],
    presetSkillIds: ["status-writer", "research-brief"],
    skillIds: ["status-writer", "research-brief"],
    knowledgePackIds: ["delivery-playbook", "customer-voice"],
    defaultMemoryEnabled: true
  }
];
