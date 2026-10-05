import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, beforeAll } from "vitest";

const DIR = path.join(process.cwd(), "prisma", "seed-data");
const load = async (f: string) => JSON.parse(await readFile(path.join(DIR, f), "utf8"));

interface Curated {
  slug: string;
  evidenceNotesPt: Record<string, string>;
  whyThisExerciseExistsPt: string;
  whyThisExerciseExistsEn: string;
  rangeOfMotionPt: string;
  rangeOfMotionEn: string;
}
interface CatalogExercise {
  slug: string;
  instructionsPt: string[];
  instructionsEn: string[];
}
interface Source {
  key: string;
  summaryEn: string;
  summaryPt: string;
}

describe("A-014 science notes match their cited study (no reversed claims)", () => {
  let bySlug: Map<string, Curated>;
  beforeAll(async () => {
    const curated = (await load("curated-exercises.generated.json")) as Curated[];
    bySlug = new Map(curated.map((c) => [c.slug, c]));
  });

  it("leg-press / Wirth: no 'comparáveis' claim; states the squat transferred better", () => {
    const c = bySlug.get("leg-press")!;
    const note = c.evidenceNotesPt["wirth-2016-squat-vs-leg-press-speed-strength"];
    expect(note).not.toMatch(/comparáveis/i);
    expect(note).toMatch(/transferiu melhor|força rápida/i);
    expect(note).toMatch(/hipertrofia não foi avaliada/i);
    expect(c.whyThisExerciseExistsPt).not.toMatch(/speed-strength comparáveis/i);
    expect(c.whyThisExerciseExistsEn).not.toMatch(/comparable strength and speed-strength/i);
  });

  it("hack-squat / Kubo: depth grows glutes+adductors, quads similar (not 'quadríceps')", () => {
    const c = bySlug.get("hack-squat")!;
    const note = c.evidenceNotesPt["kubo-2019-squat-depth-muscle-volume"];
    expect(note).toMatch(/glúteo|adutores/i);
    expect(note).toMatch(/semelhante/i);
    expect(c.rangeOfMotionPt).not.toMatch(/volume muscular no quadríceps e nos glúteos com amplitude completa/i);
    expect(c.rangeOfMotionEn).not.toMatch(/greater quadriceps and glute volume gains/i);
  });

  it("wide-grip pulldown / Andersen+Lusk: similar activation; pronated vs supinated", () => {
    const c = bySlug.get("wide-grip-lat-pulldown")!;
    const andersen = c.evidenceNotesPt["andersen-2014-lat-pulldown-grip-width"];
    expect(andersen).toMatch(/ativação muscular semelhante/i);
    expect(andersen).not.toMatch(/diferenças reais de força e ativação/i);
    const lusk = c.evidenceNotesPt["lusk-2010-pulldown-grip-forearm-orientation"];
    expect(lusk).toMatch(/supinada/i);
    expect(lusk).not.toMatch(/pronada vs\.? neutra/i);
    expect(c.whyThisExerciseExistsEn).toMatch(/similar muscle activation across widths/i);
  });

  it("side-lateral-raise / Coratella: no cable condition cited", () => {
    const c = bySlug.get("side-lateral-raise")!;
    const note = c.evidenceNotesPt["coratella-2020-lateral-raise-variants-emg"];
    expect(note).toMatch(/não compara cabo/i);
    expect(note).toMatch(/rotação do úmero/i);
    expect(c.whyThisExerciseExistsEn).not.toMatch(/cable versus dumbbell/i);
    expect(c.whyThisExerciseExistsPt).not.toMatch(/cabo versus halter/i);
  });

  it("barbell-hip-thrust / Barbalho: states the squat won for glutes (9,4% vs 3,7%)", () => {
    const c = bySlug.get("barbell-hip-thrust")!;
    const note = c.evidenceNotesPt["barbalho-2020-squat-vs-hip-thrust-women"];
    expect(note).toMatch(/9,4% vs 3,7%/);
    expect(note).toMatch(/agachamento superou o hip thrust|não como exercício superior ou equivalente/i);
  });

  it("leverage-chest-press / Schwanbeck: biceps/quads measured, chest not", () => {
    const c = bySlug.get("leverage-chest-press")!;
    const note = c.evidenceNotesPt["schwanbeck-2020-free-weights-vs-machines"];
    expect(note).toMatch(/bíceps e quadríceps/i);
    expect(note).toMatch(/peitoral não foi medido/i);
    expect(note).not.toMatch(/ganho de massa muscular no peito/i);
  });
});

describe("A-069 kettlebell instructions are pt-BR, not the English array", () => {
  let bySlug: Map<string, CatalogExercise>;
  beforeAll(async () => {
    const catalog = (await load("exercises.generated.json")) as CatalogExercise[];
    bySlug = new Map(catalog.map((e) => [e.slug, e]));
  });
  for (const slug of [
    "kettlebell-halo",
    "kettlebell-halo-with-overhead-extension",
    "kettlebell-overhead-triceps-extension",
  ]) {
    it(`${slug}: instructionsPt differs from instructionsEn and reads pt-BR`, () => {
      const e = bySlug.get(slug)!;
      expect(e.instructionsPt).not.toEqual(e.instructionsEn);
      expect(e.instructionsPt[0]).not.toMatch(/^Stand\b/);
      expect(e.instructionsPt.join(" ")).toMatch(/kettlebell|posição inicial/i);
    });
  }
});

describe("A-070 e1RM copy + source summaries", () => {
  it("principles no longer claim Brzycki is shown alongside", async () => {
    const src = await readFile(path.join(DIR, "principles.ts"), "utf8");
    expect(src).not.toMatch(/shows the Brzycki estimate alongside/i);
    expect(src).not.toMatch(/mostra a estimativa de Brzycki ao lado/i);
  });
  it("brzycki/lesuer summaries have no internal pipeline notes", async () => {
    const science = (await load("science.generated.json")) as { sources: Source[] };
    const byKey = new Map(science.sources.map((s) => [s.key, s]));
    for (const key of [
      "brzycki-1993-predicting-one-rep-max-reps-to-fatigue",
      "lesuer-1997-accuracy-1rm-prediction-equations",
    ]) {
      const s = byKey.get(key)!;
      for (const field of [s.summaryEn, s.summaryPt]) {
        expect(field).not.toMatch(/retrievable via PubMed|não foi possível obter o texto do resumo|Semantic Scholar|could not be independently confirmed|não puderam ser confirmados/i);
      }
    }
  });
  it("estimated-1rm comment no longer over-claims 'validated'", async () => {
    const src = await readFile(path.join(process.cwd(), "src/lib/training/estimated-1rm.ts"), "utf8");
    expect(src).not.toMatch(/validated against measured 1RM/i);
    expect(src).toMatch(/compared against measured 1RM/i);
  });
});
