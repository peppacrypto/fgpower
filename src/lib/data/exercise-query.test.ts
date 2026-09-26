import { describe, expect, it } from "vitest";
import { exerciseSearchTerms, exerciseSearchWhere } from "./exercise-query";

/** Mirrors Postgres `searchText LIKE '%alt%'` for every AND-ed group. */
function matches(q: string, searchText: string) {
  return exerciseSearchTerms(q).every((alts) => alts.some((alt) => searchText.includes(alt)));
}

describe("exerciseSearchTerms", () => {
  it("splits into normalized words and drops connectives", () => {
    expect(exerciseSearchTerms("Supino com Halter")).toEqual([["supino"], ["halter"]]);
    expect(exerciseSearchTerms("  Rosca   Martelo ")).toEqual([["rosca"], ["martelo"]]);
    expect(exerciseSearchTerms("extensão de tríceps")).toEqual([
      ["extensao", "extensoes", "extensaes"],
      ["tricep"],
    ]);
  });

  it("returns nothing for an empty or punctuation-only query", () => {
    expect(exerciseSearchTerms("")).toEqual([]);
    expect(exerciseSearchTerms("  - , ")).toEqual([]);
  });

  it("keeps a query made only of connectives", () => {
    expect(exerciseSearchTerms("de")).toEqual([["de"]]);
  });

  it("stems pt-BR plurals lightly", () => {
    expect(exerciseSearchTerms("halteres")).toEqual([["halter"]]);
    expect(exerciseSearchTerms("barras")).toEqual([["barra"]]);
    expect(exerciseSearchTerms("flexões")).toEqual([["flexoes", "flexao"]]);
    expect(exerciseSearchTerms("elevação")).toEqual([["elevacao", "elevacoes", "elevacaes"]]);
    expect(exerciseSearchTerms("laterais")).toEqual([["laterais", "lateral"]]);
    expect(exerciseSearchTerms("lateral")).toEqual([["lateral", "laterais"]]);
    expect(exerciseSearchTerms("press")).toEqual([["press"]]);
    expect(exerciseSearchTerms("pés")).toEqual([["pes"]]);
  });

  it("dedupes repeated words", () => {
    expect(exerciseSearchTerms("supino supino")).toEqual([["supino"]]);
  });

  it("caps the query length and the number of words", () => {
    expect(exerciseSearchTerms("a b c d e f g h i j k l m n o p q r s t u v w x y z")).toHaveLength(6);
    expect(exerciseSearchTerms("remo ".repeat(2000) + "supino")).toEqual([["remo"]]);
    const long = "x".repeat(5000);
    expect(exerciseSearchTerms(long)[0][0]).toHaveLength(100);
  });
});

describe("matching behaviour (as the DB applies it)", () => {
  const inclinado = "incline dumbbell bench press supino inclinado com halteres";
  const puxadaNeutra = "neutral grip lat pulldown puxada com pegada neutra";
  const elevacaoLateral = "lateral raise elevacao lateral com halter";
  const flexao = "push-up flexao de bracos";

  it("matches non-adjacent and reordered words", () => {
    expect(matches("supino halter", inclinado)).toBe(true);
    expect(matches("halter supino", inclinado)).toBe(true);
    expect(matches("puxada neutra", puxadaNeutra)).toBe(true);
  });

  it("matches singular and plural both ways", () => {
    expect(matches("supino halteres", inclinado)).toBe(true);
    expect(matches("elevações laterais", elevacaoLateral)).toBe(true);
    expect(matches("flexões", flexao)).toBe(true);
    expect(matches("braço", flexao)).toBe(true);
  });

  it("still requires every word", () => {
    expect(matches("supino barra", inclinado)).toBe(false);
    expect(matches("puxada supinada", puxadaNeutra)).toBe(false);
  });
});

describe("exerciseSearchWhere", () => {
  it("builds an AND of per-word ORs for Prisma", () => {
    expect(exerciseSearchWhere("")).toEqual({});
    expect(exerciseSearchWhere("   ")).toEqual({});
    expect(exerciseSearchWhere("supino flexões")).toEqual({
      AND: [
        { searchText: { contains: "supino" } },
        { OR: [{ searchText: { contains: "flexoes" } }, { searchText: { contains: "flexao" } }] },
      ],
    });
  });
});

describe("exerciseSearchWhere with nothing searchable", () => {
  it("matches no exercise for a punctuation-only query", () => {
    expect(exerciseSearchWhere("%%")).toEqual({ id: { in: [] } });
    expect(exerciseSearchWhere(" - , ")).toEqual({ id: { in: [] } });
  });
});
