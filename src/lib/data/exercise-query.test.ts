import { describe, expect, it } from "vitest";
import {
  asksForStretching,
  isStretchWord,
  exerciseSearchTerms,
  exerciseSearchWhere,
  matchingMuscleIds,
  matchTier,
  MATCH_TIER,
  rankExercises,
  rankKey,
  searchWords,
  type MuscleForSearch,
  type RankCandidate,
} from "./exercise-query";

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

/** An AND-group as exerciseSearchWhere builds it (no muscles given): searchText or an alias. */
const textGroup = (...alts: string[]) => ({
  OR: [
    ...alts.map((alt) => ({ searchText: { contains: alt } })),
    ...alts.map((alt) => ({ aliases: { some: { alias: { contains: alt, mode: "insensitive" } } } })),
  ],
});

describe("exerciseSearchWhere", () => {
  it("builds an AND of per-word ORs over searchText and aliases", () => {
    expect(exerciseSearchWhere("")).toEqual({});
    expect(exerciseSearchWhere("   ")).toEqual({});
    expect(exerciseSearchWhere("supino flexões")).toEqual({
      AND: [textGroup("supino"), textGroup("flexoes", "flexao")],
    });
  });

  it("adds the primary muscles a word names", () => {
    const where = exerciseSearchWhere("glúteo", MUSCLES);
    expect(where).toEqual({
      AND: [
        {
          OR: [
            ...textGroup("gluteo").OR,
            { muscles: { some: { role: "PRIMARY", muscleId: { in: ["glutes"] } } } },
          ],
        },
      ],
    });
  });
});

describe("exerciseSearchWhere for stretching words", () => {
  it("lets a stretching word match every stretch, whatever its name says", () => {
    expect(exerciseSearchWhere("mobilidade")).toEqual({
      AND: [{ OR: [...textGroup("mobilidade").OR, { category: "STRETCHING" }] }],
    });
    // Each word still has to match: "mobilidade quadril" is stretches that also say quadril.
    expect(exerciseSearchWhere("mobilidade quadril")).toEqual({
      AND: [{ OR: [...textGroup("mobilidade").OR, { category: "STRETCHING" }] }, textGroup("quadril")],
    });
    expect(exerciseSearchWhere("aquecimento")).toEqual({
      AND: [{ OR: [...textGroup("aquecimento").OR, { category: "STRETCHING" }] }],
    });
  });

  it("leaves other words to names, aliases and muscles", () => {
    expect(exerciseSearchWhere("supino")).toEqual({ AND: [textGroup("supino")] });
  });
});

describe("isStretchWord", () => {
  it("reads any form of the word", () => {
    expect(isStretchWord(["alongamentos", "alongamento"])).toBe(true);
    expect(isStretchWord(["flexibilidade"])).toBe(true);
    expect(isStretchWord(["mob"])).toBe(false);
    expect(isStretchWord(["flexao", "flexoes"])).toBe(false);
  });
});

describe("exerciseSearchWhere with nothing searchable", () => {
  it("matches no exercise for a punctuation-only query", () => {
    expect(exerciseSearchWhere("%%")).toEqual({ id: { in: [] } });
    expect(exerciseSearchWhere(" - , ")).toEqual({ id: { in: [] } });
  });
});

const MUSCLES: MuscleForSearch[] = [
  { id: "chest", namePt: "Peitoral", nameEn: "Chest", group: "CHEST" },
  { id: "lats", namePt: "Latíssimo do dorso", nameEn: "Latissimus Dorsi", group: "BACK" },
  { id: "glutes", namePt: "Glúteos", nameEn: "Glutes", group: "GLUTES" },
  { id: "hamstrings", namePt: "Isquiotibiais", nameEn: "Hamstrings", group: "LEGS" },
  { id: "quadriceps", namePt: "Quadríceps", nameEn: "Quadriceps", group: "LEGS" },
  { id: "posterior-deltoid", namePt: "Deltoide posterior", nameEn: "Posterior Deltoid", group: "SHOULDERS" },
];

describe("matchingMuscleIds", () => {
  const ids = (q: string) => matchingMuscleIds(exerciseSearchTerms(q)[0], MUSCLES);

  it("finds a muscle by its pt/en name, group label or gym synonym, accents ignored", () => {
    expect(ids("gluteo")).toEqual(["glutes"]);
    expect(ids("Glúteos")).toEqual(["glutes"]);
    expect(ids("peito")).toEqual(["chest"]);
    expect(ids("costas")).toEqual(["lats"]);
    expect(ids("pernas")).toEqual(["hamstrings", "quadriceps"]);
    expect(ids("posterior")).toEqual(["hamstrings", "posterior-deltoid"]);
  });

  it("matches word starts only, not the middle of a word", () => {
    expect(ids("ceps")).toEqual([]);
    expect(ids("supino")).toEqual([]);
  });
});

describe("asksForStretching", () => {
  it("is true only when the search names stretching or mobility work", () => {
    expect(asksForStretching("alongamento de glúteo")).toBe(true);
    expect(asksForStretching("Along")).toBe(true);
    expect(asksForStretching("mobilidade quadril")).toBe(true);
    expect(asksForStretching("hip stretch")).toBe(true);
    expect(asksForStretching("glúteo")).toBe(false);
    expect(asksForStretching("supino")).toBe(false);
  });
});

describe("matchTier", () => {
  it("starts-with beats whole word beats contains beats a muscle-only match", () => {
    expect(matchTier("supino re", ["Supino Reto com Barra"])).toBe(MATCH_TIER.PHRASE_START);
    expect(matchTier("supino halter", ["Supino com Halteres"])).toBe(MATCH_TIER.FIRST_WORD);
    expect(matchTier("martelo rosca", ["Rosca Martelo"])).toBe(MATCH_TIER.WHOLE_WORDS);
    expect(matchTier("halteres", ["Crucifixo com Halter"])).toBe(MATCH_TIER.WHOLE_WORDS);
    expect(matchTier("flexao", ["Rosca com flexões"])).toBe(MATCH_TIER.WHOLE_WORDS);
    expect(matchTier("inclin", ["Supino Inclinado"])).toBe(MATCH_TIER.WORD_STARTS);
    expect(matchTier("clinado", ["Supino Inclinado"])).toBe(MATCH_TIER.CONTAINS);
    expect(matchTier("gluteo", ["Hip Thrust com Barra", "Barbell Hip Thrust"])).toBe(MATCH_TIER.OTHER);
  });

  it("reads aliases and the English name like the pt name", () => {
    expect(matchTier("elevação pélvica", ["Hip Thrust com Barra", "Barbell Hip Thrust", "Elevação pélvica"])).toBe(
      MATCH_TIER.PHRASE_START,
    );
    expect(matchTier("leg press", ["Leg Press 45°", "Leg Press"])).toBe(MATCH_TIER.PHRASE_START);
  });
});

describe("rankExercises", () => {
  const ex = (id: string, namePt: string, extra: Partial<RankCandidate> = {}): RankCandidate => ({
    id,
    namePt,
    nameEn: "",
    aliases: [],
    popularity: 0,
    isCurated: false,
    ...extra,
  });

  it("puts 'Flexão de Braço' first for 'flexao', not 13th alphabetically", () => {
    const ranked = rankExercises("flexao", [
      ex("a", "Abdominal com Flexão de Tronco"),
      ex("b", "Agachamento com Flexão Plantar"),
      ex("c", "Flexão Lateral de Tronco"),
      ex("d", "Flexão de Braço"),
      ex("e", "Crucifixo Inverso", { aliases: [] }),
    ]);
    expect(ranked.map((e) => e.namePt)).toEqual([
      "Flexão de Braço",
      "Flexão Lateral de Tronco",
      "Abdominal com Flexão de Tronco",
      "Agachamento com Flexão Plantar",
      "Crucifixo Inverso",
    ]);
  });

  it("orders a tier by popularity, then curated content, then name", () => {
    const ranked = rankExercises("gluteo", [
      ex("1", "Agachamento Búlgaro", { popularity: 3 }),
      ex("2", "Hip Thrust com Barra", { popularity: 9 }),
      ex("3", "Ponte de Glúteo com Barra"),
      ex("4", "Abdução de Quadril", { isCurated: true }),
      ex("5", "Afundo"),
    ]);
    expect(ranked.map((e) => e.id)).toEqual(["3", "2", "1", "4", "5"]);
  });

  it("counts a word naming a primary muscle as a whole word, so the most used lift leads 'peito'", () => {
    const list = [
      ex("throw", "Arremesso de Peito com Medicine Ball", { muscleIds: ["chest"] }),
      ex("bench", "Supino Reto com Barra", { popularity: 12, muscleIds: ["chest"] }),
      ex("fly", "Crucifixo com Halteres", { popularity: 4, muscleIds: ["chest"] }),
      ex("dip", "Paralelas", { popularity: 2, muscleIds: ["triceps"] }),
    ];
    expect(rankExercises("peito", list, MUSCLES).map((e) => e.id)).toEqual(["bench", "fly", "throw", "dip"]);
    // Without the muscles the name match leads, as before.
    expect(rankExercises("peito", list)[0].id).toBe("throw");
    // "supino peito": the name starts with the first word, the muscle covers the second.
    expect(rankKey("supino peito", list[1], [[], ["chest"]])).toEqual({ tier: MATCH_TIER.FIRST_WORD, viaAlias: 0 });
  });

  it("is a total order: same names sort by id, and the input order never matters", () => {
    const list = [ex("b", "Remada Curvada"), ex("a", "Remada Curvada"), ex("c", "Remada Baixa")];
    const once = rankExercises("remada", list).map((e) => e.id);
    expect(once).toEqual(["c", "a", "b"]);
    expect(rankExercises("remada", [...list].reverse()).map((e) => e.id)).toEqual(once);
  });

  it("puts the exercise's own name before a nickname at the same tier, unless the query is the nickname", () => {
    const list = [
      ex("leg-curl", "Mesa Flexora", { popularity: 20, aliases: ["flexão de joelhos deitado", "leg curl deitado"] }),
      ex("push-up", "Flexão de Braço", { popularity: 3, aliases: ["apoio", "push-up"] }),
      ex("decline", "Flexão Declinada"),
      ex("side", "Abdominal com Flexão Lateral"),
    ];
    expect(rankExercises("flexao", list).map((e) => e.id)).toEqual(["push-up", "decline", "leg-curl", "side"]);
    expect(rankExercises("push up", list)[0].id).toBe("push-up");
    expect(rankExercises("leg curl", list)[0].id).toBe("leg-curl");
  });

  it("finds a pt-BR nickname through an alias", () => {
    const ranked = rankExercises("remada baixa", [
      ex("x", "Remada Sentada na Polia Baixa", { aliases: ["Remada baixa"] }),
      ex("y", "Remada ao Pescoço na Polia Baixa"),
    ]);
    expect(ranked[0].id).toBe("x");
  });
});

describe("rankKey", () => {
  const c = (namePt: string, aliases: string[] = []): RankCandidate => ({ id: namePt, namePt, nameEn: "", aliases, popularity: 0, isCurated: false });
  it("marks a tier reached only through an alias", () => {
    expect(rankKey("elevação pélvica", c("Hip Thrust com Barra", ["Elevação pélvica com barra"]))).toEqual({
      tier: MATCH_TIER.PHRASE_START,
      viaAlias: 1,
    });
    expect(rankKey("elevação pélvica", c("Hip Thrust com Barra", ["Elevação pélvica"]))).toEqual({
      tier: MATCH_TIER.PHRASE_START,
      viaAlias: 0,
    });
    expect(rankKey("hip", c("Hip Thrust com Barra", ["Elevação pélvica"]))).toEqual({ tier: MATCH_TIER.PHRASE_START, viaAlias: 0 });
  });
});

describe("searchWords", () => {
  it("lowercases, strips accents and splits on anything that isn't a letter or digit", () => {
    expect(searchWords("Leg Press 45° (Máquina)")).toEqual(["leg", "press", "45", "maquina"]);
  });
});
