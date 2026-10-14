import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, splitTakeaway } from "./markdown";

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

describe("splitTakeaway", () => {
  it("lifts the practical paragraph out whole and keeps the rest in order", () => {
    const text = [
      "O RIR estima quantas repetições ainda restariam.",
      "Um estudo de validade encontrou\ncorrelação forte.",
      '**A abordagem da FGPOWER:** alvo de RIR 1 a 3 (apoiado pela literatura "abaixo").',
    ].join("\n\n");
    const { takeaway, body } = splitTakeaway(text);
    expect(takeaway).toBe('**A abordagem da FGPOWER:** alvo de RIR 1 a 3 (apoiado pela literatura "abaixo").');
    expect(body).toBe("O RIR estima quantas repetições ainda restariam.\n\nUm estudo de validade encontrou\ncorrelação forte.");
  });

  it("knows the 'Conclusão prática' label, with or without words before the colon", () => {
    expect(splitTakeaway("Texto.\n\n**Conclusão prática:** descanse.").takeaway).toBe("**Conclusão prática:** descanse.");
    expect(splitTakeaway("Texto.\n\n**Conclusão prática para quem corre:** separe.").takeaway).toBe(
      "**Conclusão prática para quem corre:** separe.",
    );
  });

  it("leaves a text without one as it is (a bold lead elsewhere is not a takeaway)", () => {
    const text = "Primeiro.\n\n**As estimativas ficam menos confiáveis.** Com mais reps.";
    expect(splitTakeaway(text)).toEqual({ takeaway: null, body: text });
  });
});
