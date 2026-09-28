import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenceReferences, type EvidenceItem } from "./evidence-references";

const source = (over: Partial<EvidenceItem["source"]> = {}): EvidenceItem["source"] => ({
  title: "Validity of RIR-based RPE",
  authors: "Zourdos et al.",
  journal: "J Strength Cond Res",
  publicationYear: 2016,
  url: "https://example.org/rir",
  evidenceLevel: "B",
  abstractSummary: "Cross-sectional validity study (n=29) of the RIR-based RPE scale.",
  summaryPt: null,
  ...over,
});
const render = (items: EvidenceItem[]) => renderToStaticMarkup(createElement(EvidenceReferences, { items }));

describe("EvidenceReferences (W-077)", () => {
  it("folds an English-only abstract under 'Resumo original (inglês)', closed, marked lang=en", () => {
    const html = render([{ sourceId: "a", source: source() }]);
    expect(html).toMatch(/<details class="[^"]*">/);
    expect(html).not.toContain("<details open");
    expect(html).toContain("Resumo original (inglês)");
    expect(html).toMatch(/<p lang="en"[^>]*>Cross-sectional validity study/);
    expect(html).toContain("Ver fonte");
    expect(html).toContain('href="https://example.org/rir"');
  });

  it("shows the Portuguese summary instead, and no English abstract at all", () => {
    const html = render([{ sourceId: "a", source: source({ summaryPt: "Estudo de validade: o RIR acompanha a perda de velocidade." }) }]);
    expect(html).toContain("Estudo de validade: o RIR acompanha a perda de velocidade.");
    expect(html).not.toContain("Cross-sectional");
    expect(html).not.toContain("<details");
  });

  it("is a section headed 'Referências' with a count, and renders nothing without sources", () => {
    const html = render([
      { sourceId: "a", source: source() },
      { sourceId: "b", source: source({ summaryPt: "Resumo." }) },
    ]);
    expect(html).toMatch(/<h2 id="referencias"[^>]*>Referências<\/h2>/);
    expect(html).toContain("2 fontes");
    expect(render([])).toBe("");
  });
});
