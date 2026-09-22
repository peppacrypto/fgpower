import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";

const render = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe("Markdown", () => {
  it("keeps plain paragraphs with bold and italic", () => {
    const html = render("**Por que?** Porque *funciona*.\n\nSegundo parágrafo.");
    expect(html).toContain("<p><strong>Por que?</strong> Porque <em>funciona</em>.</p>");
    expect(html).toContain("<p>Segundo parágrafo.</p>");
  });

  it("renders headings and lists instead of raw markers", () => {
    const html = render("### A semana\n- **Seg:** superior\n- **Ter:** inferior\n\n1. primeiro\n2. segundo");
    expect(html).toContain("A semana</h3>");
    expect(html).toContain("<li><strong>Seg:</strong> superior</li>");
    expect(html).toMatch(/<ol[^>]*><li>primeiro<\/li><li>segundo<\/li><\/ol>/);
    expect(html).not.toContain("###");
  });

  it("starts a heading even without a blank line before the following text", () => {
    const html = render("### O que vem depois\nO GD 2 muda a divisão.");
    expect(html).toContain("O que vem depois</h3><p>O GD 2 muda a divisão.</p>");
  });

  it("does not treat a line opening with bold as a bullet", () => {
    expect(render("**Dor:** reduza a carga")).toContain("<p><strong>Dor:</strong> reduza a carga</p>");
  });
});
