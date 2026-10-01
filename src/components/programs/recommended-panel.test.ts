import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The start action is a server action (auth, the database): not what these tests render.
vi.mock("@/lib/actions/programs", () => ({ startTemplateAndBegin: async () => undefined }));

const { RecommendedPanel } = await import("./recommended-panel");
type Pick = Parameters<typeof RecommendedPanel>[0]["picks"][number];

const pick = (slug: string, over: Partial<Pick> = {}): Pick => ({
  slug,
  namePt: `Programa ${slug}`,
  taglinePt: "Um bom programa.",
  reasons: [
    { label: "3×/semana", match: true },
    { label: "Iniciante", match: true },
  ],
  ...over,
});
const render = (picks: Pick[]) => renderToStaticMarkup(createElement(RecommendedPanel, { picks }));

describe("RecommendedPanel (L-home-catalog-gap)", () => {
  it("starts a pick that runs as it is in one tap", () => {
    const html = render([pick("a"), pick("b"), pick("c")]);
    expect(html).toContain("Ativar e começar");
    expect(html).not.toContain("Adaptar e começar");
    expect(html).not.toContain('/adapt"');
  });

  it("sends a pick that needs swaps to the adapt review, and says so on its chip", () => {
    const adaptChip = { label: "Com adaptação", match: false, kind: "adapt" as const };
    const html = render([pick("kb", { adapt: true, reasons: [adaptChip] }), pick("b")]);
    expect(html).toContain('href="/app/programs/templates/kb/adapt"');
    expect(html).toContain("Adaptar e começar");
    expect(html).not.toContain("Ativar e começar");
    expect(html).toContain("alguns exercícios são trocados pelo seu equipamento");
  });

  it("reads the adapt chip when a caller doesn't pass `adapt` (Today's picks)", () => {
    const html = render([pick("kb", { reasons: [{ label: "Com adaptação", match: false, kind: "adapt" }] })]);
    expect(html).toContain('href="/app/programs/templates/kb/adapt"');
  });

  it("lists two alternates at most, with their facts", () => {
    const html = render([pick("a"), pick("b"), pick("c"), pick("d")]);
    expect(html).toContain("Outras opções");
    expect(html).toContain('href="/app/programs/templates/b"');
    expect(html).toContain('href="/app/programs/templates/c"');
    expect(html).not.toContain('href="/app/programs/templates/d"');
  });
});
