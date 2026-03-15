import { describe, expect, it } from "vitest";

import { providerBrandInfo, providerFallbackGlyph } from "./ProviderLogo.js";

describe("ProviderLogo helpers", () => {
  it("maps common providers to brand marks", () => {
    expect(providerBrandInfo("openai")?.title).toBe("OpenAI");
    expect(providerBrandInfo("anthropic")?.title).toBe("Anthropic");
    expect(providerBrandInfo("github-copilot")?.title).toBe("GitHub Copilot");
  });

  it("falls back to stable glyphs for unknown brands", () => {
    expect(providerFallbackGlyph("openai")).toBe("OA");
    expect(providerFallbackGlyph("github-copilot")).toBe("GH");
    expect(providerFallbackGlyph("unknown-provider")).toBe("UN");
  });
});
