import { describe, expect, it } from "vitest";
import type { InstalledSkillEntry } from "@slackclaw/contracts";

import { filterMarketplaceSearchResults, skillMissingSummary, skillReadinessTone, skillSourceLabel } from "./SkillsPage.js";

const baseSkill: InstalledSkillEntry = {
  id: "weather",
  slug: "weather",
  name: "Weather",
  description: "Get weather details.",
  source: "clawhub",
  bundled: false,
  eligible: true,
  disabled: false,
  blockedByAllowlist: false,
  readiness: "ready",
  missing: {
    bins: [],
    anyBins: [],
    env: [],
    config: [],
    os: []
  },
  homepage: "https://example.com/weather",
  version: "1.0.0",
  managedBy: "clawhub",
  editable: false,
  removable: true,
  updatable: true
};

describe("SkillsPage helpers", () => {
  it("maps installed skill sources to stable labels", () => {
    expect(skillSourceLabel(baseSkill)).toBe("ClawHub");
    expect(skillSourceLabel({ ...baseSkill, source: "custom" })).toBe("Custom");
    expect(skillSourceLabel({ ...baseSkill, source: "bundled" })).toBe("Bundled");
  });

  it("maps readiness to the expected badge tone", () => {
    expect(skillReadinessTone(baseSkill)).toBe("success");
    expect(skillReadinessTone({ ...baseSkill, readiness: "missing" })).toBe("warning");
    expect(skillReadinessTone({ ...baseSkill, readiness: "blocked" })).toBe("neutral");
  });

  it("summarizes missing requirements for non-ready skills", () => {
    expect(
      skillMissingSummary({
        ...baseSkill,
        readiness: "missing",
        missing: {
          bins: ["python3"],
          anyBins: [],
          env: ["OPENWEATHER_API_KEY"],
          config: [],
          os: []
        }
      })
    ).toBe("bins: python3 · env: OPENWEATHER_API_KEY");
  });

  it("filters marketplace search results down to uninstalled unique skills", () => {
    expect(
      filterMarketplaceSearchResults([
        { slug: "weather-api", name: "Weather API", summary: "Weather", installed: false, curated: true },
        { slug: "weather-api", name: "Weather API", summary: "Duplicate", installed: false, curated: false },
        { slug: "slack-sync", name: "Slack Sync", summary: "Sync", installed: true, curated: false }
      ])
    ).toEqual([
      { slug: "weather-api", name: "Weather API", summary: "Weather", installed: false, curated: true }
    ]);
  });
});
