import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./BrandMark.js";

describe("BrandMark", () => {
  it("renders the wordless ChillClaw logo with an accessible product label", () => {
    const markup = renderToStaticMarkup(<BrandMark />);

    expect(markup).toContain("brand-mark");
    expect(markup).toContain('alt="ChillClaw"');
    expect(markup).toContain("chillclaw-logo-simple-1-640.webp");
  });

  it("can render as decorative chrome when nearby text already names ChillClaw", () => {
    const markup = renderToStaticMarkup(<BrandMark decorative />);

    expect(markup).toContain('alt=""');
    expect(markup).toContain('aria-hidden="true"');
  });
});
