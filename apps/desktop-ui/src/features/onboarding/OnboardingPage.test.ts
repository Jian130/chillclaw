import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("OnboardingPage CTA styling", () => {
  it("uses one shared class hook for forward onboarding actions", () => {
    const source = readFileSync(fileURLToPath(new URL("./OnboardingPage.tsx", import.meta.url)), "utf8");

    expect(source.match(/onboarding-primary-action/g)).toHaveLength(7);
  });
});
