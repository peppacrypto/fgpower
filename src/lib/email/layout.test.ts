import { describe, expect, it } from "vitest";
import { esc, renderEmail } from "./layout";

describe("esc", () => {
  it("escapes markup and quotes", () => {
    expect(esc(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
    expect(esc(null)).toBe("");
  });
});

describe("renderEmail", () => {
  const content = {
    preheader: "Semana passada: 3/4 treinos",
    kicker: "FGPOWER · RESUMO SEMANAL",
    title: "Olá, <b>Ana</b>.",
    blocks: [
      { type: "heading" as const, text: "Semana passada" },
      { type: "paragraph" as const, text: "3/4 treinos · faltou 1" },
      { type: "code" as const, text: "482 913" },
      { type: "list" as const, items: ["Dias: SEG · QUA · SEX", "Hoje: Superior A"] },
    ],
    cta: { label: "Abrir o treino de hoje", href: "https://fgpower.monster/r/abc?x=1&y=2" },
    footer: {
      lines: ["Você recebe este resumo porque ativou o resumo semanal."],
      links: [
        { label: "Parar de receber", href: "https://fgpower.monster/email/cancelar?t=tok" },
        { label: "Mau", href: "javascript:alert(1)" },
      ],
    },
  };

  it("escapes every interpolated value and keeps only http(s)/mailto links", () => {
    const { html } = renderEmail(content);
    expect(html).toContain("Olá, &lt;b&gt;Ana&lt;/b&gt;.");
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain('href="https://fgpower.monster/r/abc?x=1&amp;y=2"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain("482 913");
  });

  it("mirrors the same lines as plain text", () => {
    const { text } = renderEmail(content);
    expect(text).toContain("FGPOWER · RESUMO SEMANAL\nOlá, <b>Ana</b>.");
    expect(text).toContain("SEMANA PASSADA");
    expect(text).toContain("482 913");
    expect(text).toContain("Hoje: Superior A");
    expect(text).toContain("Abrir o treino de hoje: https://fgpower.monster/r/abc?x=1&y=2");
    expect(text).toContain("Parar de receber: https://fgpower.monster/email/cancelar?t=tok");
    expect(text).not.toContain("javascript:");
  });
});
