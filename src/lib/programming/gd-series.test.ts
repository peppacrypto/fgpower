import { describe, expect, it } from "vitest";
import { seriesBlocks, seriesEntryFor, seriesLevelLabel, seriesShortLabel, splitSeriesTagline, wrapSlashes } from "./gd-series";
import { CATALOG_FIXTURE } from "./catalog-fixture";

describe("splitSeriesTagline", () => {
  it("leads with the outcome and keeps the block's place as meta", () => {
    expect(
      splitSeriesTagline(
        "Bloco 2 de 9 · semanas 5-17 (meses 2-4): base de hipertrofia em 5 dias, 80→88 séries por semana e o primeiro teste de força do plano.",
      ),
    ).toEqual({
      outcome: "Base de hipertrofia em 5 dias, 80→88 séries por semana e o primeiro teste de força do plano.",
      meta: "Bloco 2 de 9 · meses 2-4",
    });
    expect(splitSeriesTagline("Bloco 1 de 9 · semanas 1-4 (mês 1): aprenda os movimentos.")).toEqual({
      outcome: "Aprenda os movimentos.",
      meta: "Bloco 1 de 9 · mês 1",
    });
    expect(splitSeriesTagline("Bloco 6 de 9 · semanas 57-69 (meses 14-16, início do ano 2): especialização.").meta).toBe(
      "Bloco 6 de 9 · meses 14-16, início do ano 2",
    );
  });

  it("leaves any other tagline as it is", () => {
    expect(splitSeriesTagline("Uma progressão de 4 semanas.")).toEqual({ outcome: "Uma progressão de 4 semanas.", meta: null });
  });
});

describe("seriesBlocks", () => {
  it("orders the blocks Adaptação → GD 8 with the weeks each covers", () => {
    const blocks = seriesBlocks(CATALOG_FIXTURE, (slug) => `/p/${slug}`);
    const gdInFixture = CATALOG_FIXTURE.filter((t) => t.slug.startsWith("gd-")).length;
    expect(blocks).toHaveLength(gdInFixture);
    expect(blocks[0]).toMatchObject({ slug: "gd-adaptacao", short: "A", name: "GD Adaptação", fromWeek: 1, year: 1, href: "/p/gd-adaptacao" });
    for (let i = 1; i < blocks.length; i++) expect(blocks[i].fromWeek).toBe(blocks[i - 1].toWeek + 1);
    expect(blocks.map((b) => b.short).join("")).toMatch(/^A1/);
  });

  it("puts the blocks that start after week 52 in year 2", () => {
    const blocks = seriesBlocks(
      ["gd-adaptacao", "gd-1", "gd-2", "gd-3", "gd-4", "gd-5"].map((slug, i) => ({
        slug,
        durationWeeks: i === 0 ? 4 : 13,
        experienceLevel: "INTERMEDIATE",
      })),
      (slug) => slug,
    );
    expect(blocks.map((b) => [b.short, b.fromWeek, b.year])).toEqual([
      ["A", 1, 1],
      ["1", 5, 1],
      ["2", 18, 1],
      ["3", 31, 1],
      ["4", 44, 1],
      ["5", 57, 2],
    ]);
  });
});

describe("series entry", () => {
  it("starts a newcomer in the Adaptação and anyone who trains in GD 1", () => {
    expect(seriesEntryFor("BEGINNER")).toBe("gd-adaptacao");
    expect(seriesEntryFor(null)).toBe("gd-adaptacao");
    expect(seriesEntryFor("INTERMEDIATE")).toBe("gd-1");
    expect(seriesShortLabel("gd-8")).toBe("8");
  });
});

describe("series display", () => {
  it("reads GD 1 as the step after the Adaptação, not \"Iniciante\"", () => {
    expect(seriesLevelLabel("gd-adaptacao", "BEGINNER")).toBe("Iniciante");
    expect(seriesLevelLabel("gd-1", "BEGINNER")).toBe("Pós-Adaptação");
    expect(seriesLevelLabel("gd-2", "INTERMEDIATE")).toBe("Intermediário");
    expect(seriesLevelLabel("full-body-beginner", "BEGINNER")).toBe("Iniciante");
  });

  it("lets a slash-joined run wrap after each slash, and leaves numbers alone", () => {
    expect(wrapSlashes("em Empurrar/Puxar/Pernas")).toBe("em Empurrar/\u200BPuxar/\u200BPernas");
    expect(wrapSlashes("80/20 e 3/semana")).toBe("80/20 e 3/semana");
    expect(splitSeriesTagline("Bloco 4 de 9 · semanas 31-43 (meses 8-10): o maior volume, em Superior/Inferior.").outcome).toBe(
      "O maior volume, em Superior/\u200BInferior.",
    );
  });
});
