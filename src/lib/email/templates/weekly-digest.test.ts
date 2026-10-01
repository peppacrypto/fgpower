import { describe, expect, it } from "vitest";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { digestPreheader, digestSubject, weeklyDigestEmail, type DigestData } from "./weekly-digest";

const base: DigestData = {
  firstName: "Ana",
  todayNo: dayNumberOf(new Date("2026-09-28T12:00:00Z")),
  lastWeek: { done: 3, target: 4, met: false, deload: false },
  streak: { current: 5, best: 7 },
  records: ["Supino reto", "Agachamento", "Remada curvada"],
  muscles: [
    { name: "Peito", sets: 12 },
    { name: "Costas", sets: 10 },
    { name: "Quadríceps", sets: 8.5 },
    { name: "Bíceps", sets: 4 },
  ],
  program: {
    name: "GD 1",
    week: 5,
    weeks: 13,
    entry: false,
    test: false,
    rir: 1.5,
    note: "Mantenha a técnica.",
    days: "SEG · QUA · SEX",
    today: { name: "Segunda — Superior", exerciseCount: 6 },
  },
  block: null,
  urls: {
    cta: "https://fgpower.monster/r/tok",
    unsubscribe: "https://fgpower.monster/email/cancelar?t=u",
    preferences: "https://fgpower.monster/r/pref",
  },
};

describe("weekly digest", () => {
  it("subject: program week, with today's day", () => {
    expect(digestSubject(base)).toBe("Semana 5 de 13 · GD 1 — hoje: Segunda — Superior");
    expect(digestSubject({ ...base, program: { ...base.program!, today: null } })).toBe("Semana 5 de 13 · GD 1");
    expect(digestSubject({ ...base, program: { ...base.program!, test: true } })).toBe("Semana de teste · GD 1");
    expect(digestSubject({ ...base, program: { ...base.program!, weeks: null, today: null } })).toBe("Semana 5 · GD 1");
    expect(digestSubject({ ...base, program: null, block: { name: "GD 1", nextName: "GD 2" } })).toBe(
      "Bloco concluído: hora do GD 2",
    );
    expect(digestSubject({ ...base, program: null })).toBe("Sua semana na FGPOWER");
  });

  it("subject stays within 78 characters, cutting the day name", () => {
    const long = { ...base, program: { ...base.program!, today: { name: "X".repeat(120), exerciseCount: 1 } } };
    const subject = digestSubject(long);
    expect(subject.length).toBeLessThanOrEqual(78);
    expect(subject.startsWith("Semana 5 de 13 · GD 1 — hoje: X")).toBe(true);
    expect(subject.endsWith("…")).toBe(true);
  });

  it("preheader drops the parts that are zero", () => {
    expect(digestPreheader(base)).toBe("Semana passada: 3/4 treinos · 3 recordes · 5 semanas seguidas no alvo");
    expect(digestPreheader({ ...base, records: [], streak: { current: 0, best: 3 } })).toBe("Semana passada: 3/4 treinos");
    expect(digestPreheader({ ...base, lastWeek: null })).toBe("Semana passada: nenhum treino. Esta semana é um recomeço.");
  });

  it("body in pt-BR, with the unsubscribe and preferences links", () => {
    const { text, html } = weeklyDigestEmail(base);
    expect(text).toContain("FGPOWER · RESUMO SEMANAL · SEG · 28 SET");
    expect(text).toContain("Olá, Ana.");
    expect(text).toContain("3/4 treinos · faltou 1");
    expect(text).toContain("5 semanas seguidas no alvo · recorde 7");
    expect(text).toContain("Recordes: Supino reto, Agachamento (+1)");
    expect(text).toContain("Volume: Peito 12 · Costas 10 · Quadríceps 8,5 séries");
    expect(text).toContain("GD 1 · Semana 5 de 13 · RIR alvo 1,5");
    expect(text).toContain("Dias: SEG · QUA · SEX");
    expect(text).toContain("Hoje: Segunda — Superior · 6 exercícios");
    expect(text).toContain("Abrir o treino de hoje: https://fgpower.monster/r/tok");
    expect(text).toContain("Parar de receber: https://fgpower.monster/email/cancelar?t=u");
    expect(html).toContain('href="https://fgpower.monster/email/cancelar?t=u"');
    const met = weeklyDigestEmail({ ...base, lastWeek: { done: 4, target: 4, met: true, deload: false } }).text;
    expect(met).toContain("4/4 treinos · semana no alvo ✓");
  });

  it("escapes names", () => {
    const { html } = weeklyDigestEmail({ ...base, firstName: "<script>alert(1)</script>", records: ["<b>x</b>"] });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;script&gt;");
  });
});
