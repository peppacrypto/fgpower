import { describe, expect, it } from "vitest";
import { CATALOG_FIXTURE } from "./catalog-fixture";
import { recommendTemplates } from "./recommend";
import {
  type CatalogItem,
  NO_FILTERS,
  applyFilters,
  groupCatalog,
  parseQuery,
  presetFilters,
  programGroup,
  searchCatalog,
  searchLibrary,
  shelveFiltered,
} from "./catalog";

const slugs = (items: { slug: string }[]) => items.map((t) => t.slug);
const search = (q: string) => searchCatalog(CATALOG_FIXTURE, q);

describe("groupCatalog", () => {
  it("puts every template on exactly one shelf, in shelf order", () => {
    const groups = groupCatalog(CATALOG_FIXTURE);
    expect(groups.map((g) => g.label)).toEqual([
      "Plano GD",
      "Comece aqui",
      "Força & hipertrofia",
      "Especializações",
      "Esporte",
      "Casa & mínimo",
    ]);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(CATALOG_FIXTURE.length);
    expect(slugs(groups[0].items)[0]).toBe("gd-adaptacao");
  });

  it("files programs by series, equipment, sport, focus and level", () => {
    const group = (slug: string) => programGroup(CATALOG_FIXTURE.find((t) => t.slug === slug)!);
    expect(group("gd-1")).toBe("gd");
    expect(group("home-dumbbells")).toBe("home");
    expect(group("calisthenics")).toBe("home");
    expect(group("strength-for-runners")).toBe("sport");
    expect(group("glute-focus")).toBe("focus");
    expect(group("full-body-beginner")).toBe("start");
    expect(group("push-pull-legs")).toBe("core");
  });
});

describe("mobility programs (additive track)", () => {
  // A small self-contained catalog so the shared CATALOG_FIXTURE search/time
  // assumptions stay intact: mobility programs are short and bodyweight.
  const mob: CatalogItem = {
    slug: "mobilidade-diaria",
    namePt: "Mobilidade Diária Essencial",
    taglinePt: "Dez minutos de mobilidade todos os dias, só com o peso do corpo.",
    goal: "MOBILITY",
    experienceLevel: "BEGINNER",
    trainingStyle: "MOBILITY",
    equipmentAccess: "HOME_BODYWEIGHT",
    daysPerWeek: 6,
    durationWeeks: 4,
    sessionMinutes: 12,
    dayNames: ["Rotina diária de mobilidade"],
    equipmentIds: ["bodyweight", "none"],
  };
  const strength = CATALOG_FIXTURE.filter((t) => ["push-pull-legs", "glute-focus"].includes(t.slug));
  const mini = [...strength, mob];

  it("puts a mobility program on its own shelf, ahead of sport/home, beating the equipment check", () => {
    expect(programGroup(mob)).toBe("mobility");
    const groups = groupCatalog(mini);
    const labels = groups.map((g) => g.label);
    expect(labels).toContain("Mobilidade & flexibilidade");
    // Mobility sits after "Especializações" and before "Casa & mínimo" in display order.
    expect(labels.indexOf("Mobilidade & flexibilidade")).toBeLessThan(
      labels.indexOf("Casa & mínimo") === -1 ? Infinity : labels.indexOf("Casa & mínimo"),
    );
  });

  it("is reachable by the Mobilidade goal chip and by a pt-BR search", () => {
    expect(slugs(applyFilters(mini, { ...NO_FILTERS, goal: "mobility" }))).toEqual(["mobilidade-diaria"]);
    expect(slugs(searchCatalog(mini, "mobilidade").results)).toContain("mobilidade-diaria");
    expect(slugs(searchCatalog(mini, "flexibilidade").results)).toContain("mobilidade-diaria");
  });

  it("never leads the strength recommender", () => {
    const beginner = { goal: "GENERAL_FITNESS", experience: "BEGINNER", daysPerWeek: 6, sessionMinutes: 30, equipmentAccess: "HOME_BODYWEIGHT" };
    expect(recommendTemplates(beginner, mini).every((r) => r.template.slug !== "mobilidade-diaria")).toBe(true);
  });
});

describe("shelveFiltered", () => {
  // Intermediate, 5×, hypertrophy, gym: the preset leaves GD 2-4 and the pick.
  const int5 = { goal: "HYPERTROPHY", experience: "INTERMEDIATE", daysPerWeek: 5, sessionMinutes: 60, equipmentAccess: "FULL_GYM" };
  const pick = recommendTemplates(int5, CATALOG_FIXTURE)[0].template.slug;
  const shown = applyFilters(CATALOG_FIXTURE, presetFilters(int5, CATALOG_FIXTURE, pick));

  it("leads with the shelf holding the user's pick, the pick first", () => {
    expect(pick).toBe("classic-split");
    const shelves = shelveFiltered(shown, CATALOG_FIXTURE, pick);
    expect(shelves[0].key).toBe("core");
    expect(shelves[0].items[0].slug).toBe(pick);
    expect(shelves.map((s) => s.key)).toContain("gd");
  });

  it("starts a GD shelf of mid-series blocks with the series entry its blurb points to", () => {
    const gd = shelveFiltered(shown, CATALOG_FIXTURE, pick).find((s) => s.key === "gd")!;
    expect(slugs(gd.items)).toEqual(["gd-2", "gd-3", "gd-4"]);
    expect(gd.start?.slug).toBe("gd-adaptacao");
    expect(gd.blurb).toContain("Comece pela Adaptação");
    // A shelf that already holds an entry block needs no extra card.
    const beginner = applyFilters(CATALOG_FIXTURE, { ...NO_FILTERS, days: 5, level: "BEGINNER" });
    expect(shelveFiltered(beginner, CATALOG_FIXTURE, null).find((s) => s.key === "gd")!.start).toBeNull();
  });

  it("keeps every filtered program exactly once", () => {
    const shelves = shelveFiltered(shown, CATALOG_FIXTURE, pick);
    expect(shelves.flatMap((s) => slugs(s.items)).sort()).toEqual(slugs(shown).sort());
  });
});

describe("presetFilters", () => {
  it("preselects place, level and days, and the goal only while it leaves a choice", () => {
    const f = presetFilters(
      { goal: "HYPERTROPHY", experience: "BEGINNER", daysPerWeek: 3, equipmentAccess: "FULL_GYM" },
      CATALOG_FIXTURE,
    );
    expect(f).toEqual({ place: "gym", level: "BEGINNER", days: 3, goal: null });
    expect(applyFilters(CATALOG_FIXTURE, f).length).toBeGreaterThanOrEqual(3);
  });

  it("drops the days chip when no program of that frequency fits (no 4-day beginner plan)", () => {
    const f = presetFilters(
      { goal: "HYPERTROPHY", experience: "BEGINNER", daysPerWeek: 4, equipmentAccess: "FULL_GYM" },
      CATALOG_FIXTURE,
    );
    expect(f.days).toBeNull();
    expect(applyFilters(CATALOG_FIXTURE, f).length).toBeGreaterThan(0);
  });

  it("keeps equipment even when a single program fits it", () => {
    const f = presetFilters(
      { goal: "GENERAL_FITNESS", experience: "BEGINNER", daysPerWeek: 3, equipmentAccess: "HOME_BODYWEIGHT" },
      CATALOG_FIXTURE,
    );
    expect(slugs(applyFilters(CATALOG_FIXTURE, f))).toEqual(["calisthenics", "bodyweight-express"]);
  });

  it("maps a fat-loss goal to the 'Emagrecer' chip", () => {
    const f = presetFilters(
      { goal: "FAT_LOSS", experience: "BEGINNER", daysPerWeek: 3, equipmentAccess: "FULL_GYM" },
      CATALOG_FIXTURE,
    );
    expect(f.goal).toBe("fat-loss");
    for (const t of applyFilters(CATALOG_FIXTURE, f)) expect(t.equipmentAccess).toBe("FULL_GYM");
  });

  it("never hides the user's own top pick", () => {
    for (const goal of ["HYPERTROPHY", "STRENGTH", "STRENGTH_HYPERTROPHY", "GENERAL_FITNESS", "FAT_LOSS", "SPORTS_PERFORMANCE"])
      for (const experience of ["BEGINNER", "INTERMEDIATE", "ADVANCED"])
        for (const daysPerWeek of [2, 3, 4, 5, 6])
          for (const sessionMinutes of [30, 45, 60, 90])
            for (const equipmentAccess of ["FULL_GYM", "HOME_DUMBBELLS", "MINIMAL", "HOME_BODYWEIGHT"]) {
              const p = { goal, experience, daysPerWeek, sessionMinutes, equipmentAccess };
              const pick = recommendTemplates(p, CATALOG_FIXTURE)[0].template.slug;
              const shown = applyFilters(CATALOG_FIXTURE, presetFilters(p, CATALOG_FIXTURE, pick));
              expect(slugs(shown), JSON.stringify(p)).toContain(pick);
            }
  });

  it("keeps 'Emagrecer' for a fat-loss beginner, with the adaptation program they're started on", () => {
    const p = { goal: "FAT_LOSS", experience: "BEGINNER", daysPerWeek: 3, equipmentAccess: "FULL_GYM" };
    const f = presetFilters(p, CATALOG_FIXTURE, "fgpower-adaptation");
    expect(f).toEqual({ place: "gym", level: "BEGINNER", days: 3, goal: "fat-loss" });
    expect(slugs(applyFilters(CATALOG_FIXTURE, f))).toContain("fgpower-adaptation");
    // "Fitness geral" alone would hide it: that chip is left off instead.
    const fitness = presetFilters({ ...p, goal: "GENERAL_FITNESS" }, CATALOG_FIXTURE, "fgpower-adaptation");
    expect(fitness.goal).toBeNull();
  });

  it("filters nothing with no chips", () => {
    expect(applyFilters(CATALOG_FIXTURE, NO_FILTERS)).toHaveLength(CATALOG_FIXTURE.length);
  });
});

describe("searchCatalog", () => {
  it("understands fat-loss words and flags them for the honest line", () => {
    for (const q of ["emagrecer", "perder peso", "secar", "definição"]) {
      const o = search(q);
      expect(o.fatLoss).toBe(true);
      expect(o.results.length).toBeGreaterThan(3);
    }
    expect(search("hipertrofia").fatLoss).toBe(false);
  });

  it("finds home and no-equipment programs", () => {
    expect(slugs(search("sem equipamento").results)).toEqual(["calisthenics", "bodyweight-express"]);
    expect(slugs(search("em casa").results)).toContain("home-dumbbells");
    for (const t of search("em casa").results) expect(t.equipmentAccess).not.toBe("FULL_GYM");
    expect(slugs(search("halteres em casa").results)).toEqual([
      "home-dumbbells",
      "full-body-express",
      "dumbbell-upper-lower",
    ]);
  });

  it("reads 'treino ABC' as three days and 'fullbody' as full body", () => {
    expect(parseQuery("treino ABC").days).toBe(3);
    expect(parseQuery("abcde").days).toBe(5);
    for (const t of search("treino abc").results) expect(t.daysPerWeek).toBe(3);
    expect(slugs(search("fullbody").results)).toContain("full-body-beginner");
  });

  it("reads 'N min' as a time limit and offers the shortest plans when none fits", () => {
    const within = search("45 minutos");
    expect(within.note).toBeNull();
    for (const t of within.results) expect(t.sessionMinutes).toBeLessThanOrEqual(50);
    const tight = search("20 min");
    expect(tight.results.length).toBeGreaterThan(0);
    expect(tight.note).toBe("Nenhum programa cabe em 20 min — estes são os mais curtos.");
    expect(tight.results[0].sessionMinutes).toBe(30);
  });

  it("offers the neighbouring frequencies when a day count has no match, naming the ones found", () => {
    const o = search("4 dias iniciante");
    expect(o.note).toBe("Nenhum programa de 4 dias por semana com esses termos — estes têm 3 ou 5 dias.");
    for (const t of o.results) expect([3, 5]).toContain(t.daysPerWeek);
    expect(search("1 dia").note).toBe("Nenhum programa de 1 dia por semana com esses termos — estes têm 2 dias.");
    expect(search("7 dias").note).toBe("Nenhum programa de 7 dias por semana com esses termos — estes têm 6 dias.");
    expect(search("casa 5 dias").note).toBe("Nenhum programa de 5 dias por semana com esses termos — estes têm 4 dias.");
  });

  it("keeps the old behaviour: name first, whole numbers, plurals", () => {
    expect(slugs(search("GD 1").results)[0]).toBe("gd-1");
    expect(slugs(search("5x5").results)).toEqual(["linear-5x5"]);
    expect(search("iniciantes").results.length).toBe(search("iniciante").results.length);
    expect(slugs(search("corrida").results)).toEqual(["strength-for-runners"]);
    expect(search("xyzzy").results).toHaveLength(0);
  });
});

describe("searchLibrary", () => {
  const int5 = presetFilters(
    { goal: "HYPERTROPHY", experience: "INTERMEDIATE", daysPerWeek: 5, equipmentAccess: "FULL_GYM" },
    CATALOG_FIXTURE,
    "classic-split",
  );
  const filtered = applyFilters(CATALOG_FIXTURE, int5);
  const run = (q: string) => searchLibrary(CATALOG_FIXTURE, filtered, q, true);

  it("keeps exact matches inside the chips", () => {
    const o = run("GD");
    expect(o.widened).toBe(false);
    expect(o.note).toBeNull();
    for (const t of o.results) expect(slugs(filtered)).toContain(t.slug);
  });

  it("widens to the whole catalog when the chips hide every match", () => {
    const o = run("sem equipamento");
    expect(o.widened).toBe(true);
    expect(o.widenedNote).toBe("Nada com os filtros escolhidos — buscando em todos os programas.");
    expect(slugs(o.results)).toEqual(["calisthenics", "bodyweight-express"]);
  });

  it("finds a program asked for by name even when the chips hide it and others share a word", () => {
    // Inside the chips "GD 1" matches GD 3 and GD 4 ("ano 1" in their taglines) — not what was asked.
    expect(slugs(searchCatalog(filtered, "GD 1").results)).toEqual(["gd-3", "gd-4"]);
    const o = run("GD 1");
    expect(o.widened).toBe(true);
    expect(slugs(o.results)[0]).toBe("gd-1");
    expect(o.widenedNote).toBe("GD 1 está fora dos filtros escolhidos — buscando em todos os programas.");
    expect(slugs(run("halteres em casa").results)[0]).toBe("home-dumbbells");
    // A name inside the chips, a word that only starts a name, or a longer number doesn't widen.
    expect(run("divisão clássica").widened).toBe(false);
    expect(run("GD 3").widened).toBe(false);
    expect(run("GD").widened).toBe(false);
    expect(run("GD 10").widened).toBe(false);
  });

  it("widens a time limit to the shortest programs of the catalog, not of the chips", () => {
    const o = run("20 min");
    expect(o.widened).toBe(true);
    expect(o.note).toBe("Nenhum programa cabe em 20 min — estes são os mais curtos.");
    expect(o.results[0].sessionMinutes).toBe(30);
    // Inside the chips the "shortest" were 58-60 min.
    expect(Math.min(...searchCatalog(filtered, "20 min").results.map((t) => t.sessionMinutes))).toBeGreaterThan(50);
  });

  it("says the chips are why when the whole catalog does no better", () => {
    const gym3 = applyFilters(CATALOG_FIXTURE, { ...NO_FILTERS, days: 3, place: "gym" });
    const o = searchLibrary(CATALOG_FIXTURE, gym3, "iniciante 4 dias", true);
    expect(o.widened).toBe(false);
    expect(o.note).toMatch(/^Com os filtros escolhidos, nenhum programa de 4 dias por semana/);
  });

  it("searches the whole catalog as is without chips", () => {
    expect(searchLibrary(CATALOG_FIXTURE, CATALOG_FIXTURE, "30 min", false)).toEqual({
      ...searchCatalog(CATALOG_FIXTURE, "30 min"),
      widened: false,
      widenedNote: null,
    });
  });
});
