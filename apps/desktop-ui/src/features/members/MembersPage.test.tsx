import { describe, expect, it } from "vitest";

import { memberDeleteSummary, memberOriginLabel, memberOriginTone } from "./MembersPage.js";

describe("MembersPage helpers", () => {
  it("labels detected and SlackClaw-managed members distinctly", () => {
    expect(memberOriginLabel({ source: "slackclaw", hasManagedMetadata: true })).toBe("Managed by SlackClaw");
    expect(memberOriginTone({ source: "slackclaw", hasManagedMetadata: true })).toBe("success");
    expect(memberOriginLabel({ source: "detected", hasManagedMetadata: false })).toBe("Detected from OpenClaw");
    expect(memberOriginTone({ source: "detected", hasManagedMetadata: false })).toBe("warning");
  });

  it("explains when removal can keep workspace history", () => {
    expect(
      memberDeleteSummary({
        name: "Alex Morgan",
        workspaceDir: "/Users/home/Library/Application Support/OpenClaw/agents/alex/workspace"
      })
    ).toContain("/Users/home/Library/Application Support/OpenClaw/agents/alex/workspace");
  });
});
