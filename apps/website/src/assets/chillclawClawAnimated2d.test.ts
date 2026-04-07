import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const assetPath = fileURLToPath(new URL("./logos/chillclaw-claw-animated-2d.svg", import.meta.url));

describe("2D animated claw asset", () => {
  it("exists as a flat, faster variant of the ChillClaw claw logo", () => {
    const svg = readFileSync(assetPath, "utf8");

    expect(svg).toContain("Animated ChillClaw claw (2D)");
    expect(svg).toContain("animation: chillclaw-upper 1.2s ease-in-out infinite;");
    expect(svg).toContain("animation: chillclaw-lower 1.2s ease-in-out infinite;");
    expect(svg).toContain('fill="#FF5A36"');
    expect(svg).toContain('stroke="#1F1F1F"');
    expect(svg).not.toContain("feDropShadow");
    expect(svg).not.toContain("filter id=");
  });
});
