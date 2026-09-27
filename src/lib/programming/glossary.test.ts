import { describe, expect, it } from "vitest";
import { glossaryFor } from "./glossary";

describe("glossaryFor", () => {
  it("lists only the terms the notes use, whatever the spelling", () => {
    const terms = glossaryFor([
      "Top set de 6 reps, depois 2 back-offs com 10% a menos.",
      null,
      "Em supersérie com o próximo. Benchmark (testado no fim do GD 1).",
    ]).map((g) => g.term);
    expect(terms).toEqual(["Top set", "Back-off", "Superset", "Benchmark"]);
  });

  it("finds accented terms at the start of a word (JavaScript's \\b is ASCII-only)", () => {
    const terms = (text: string) => glossaryFor([text]).map((g) => g.term);
    expect(terms("Âncora + benchmark (testado na sem. 13)")).toEqual(["Âncora", "Benchmark"]);
    expect(terms("O exercício âncora do dia, com excêntrica de 3 s.")).toEqual(["Âncora", "Excêntrica"]);
    expect(terms("Descansos longos (ancoragem da técnica).")).toEqual([]);
  });

  it("is empty for plain notes", () => {
    expect(glossaryFor(["Desça devagar e suba firme.", undefined])).toEqual([]);
  });
});
