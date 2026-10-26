import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GEAR,
  GEAR_IDS,
  blockingGear,
  exerciseGear,
  gearName,
  isDoable,
  loadKindOf,
  normalizeMissingGear,
  type GearSubject,
} from "./gear";
import { GEAR_MAP } from "./gear-map.generated";

const seed = (file: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../prisma/seed-data/${file}`, import.meta.url)), "utf8"));
const catalog: { slug: string; equipment: string; category: string }[] = seed("exercises.generated.json");
const bySlug = new Map(catalog.map((e) => [e.slug, e]));
const subject = (slug: string): GearSubject => {
  const e = bySlug.get(slug);
  if (!e) throw new Error(`not in the catalog: ${slug}`);
  return { slug, equipmentId: e.equipment, category: e.category };
};

/** Every exercise a program (or the flagship) prescribes. */
function programSlugs(): string[] {
  const used = new Set<string>();
  const walk = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    const rec = o as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if ((k === "exercise" || k === "exerciseSlug" || k === "slug") && typeof v === "string" && rec.sets !== undefined) used.add(v);
      walk(v);
    }
  };
  walk(seed("programs.generated.json"));
  const flagship = readFileSync(fileURLToPath(new URL("../../../prisma/seed-data/flagship-program.ts", import.meta.url)), "utf8");
  for (const m of flagship.matchAll(/exerciseSlug: "([a-z0-9-]+)"/g)) used.add(m[1]);
  return [...used];
}

describe("the curated gear map", () => {
  it("only names catalog exercises and known gear", () => {
    for (const [slug, [gear]] of Object.entries(GEAR_MAP)) {
      expect(bySlug.has(slug), slug).toBe(true);
      for (const id of gear) expect(GEAR_IDS as readonly string[], `${slug} → ${id}`).toContain(id);
    }
  });

  it("covers every exercise a program prescribes, with gear a user can mark (never a hidden catch-all)", () => {
    const hidden = new Set(GEAR.filter((g) => !g.listed).map((g) => g.id));
    for (const slug of programSlugs()) {
      const gear = exerciseGear(subject(slug));
      expect(gear.filter((id) => hidden.has(id)), slug).toEqual([]);
    }
  });

  it("knows how the load goes on the machines people actually use", () => {
    expect(loadKindOf(subject("hack-squat"))).toBe("PLATE_MACHINE");
    expect(loadKindOf(subject("leg-press"))).toBe("PLATE_MACHINE");
    expect(loadKindOf(subject("leg-extensions"))).toBe("STACK");
    expect(loadKindOf(subject("butterfly"))).toBe("STACK");
    expect(loadKindOf(subject("lying-t-bar-row"))).toBe("PLATE_ONE_SIDE");
    expect(loadKindOf(subject("side-lateral-raise"))).toBe("DUMBBELL");
    expect(loadKindOf(subject("wide-grip-lat-pulldown"))).toBe("CABLE");
    expect(loadKindOf(subject("barbell-bench-press-medium-grip"))).toBe("BARBELL");
    expect(loadKindOf(subject("smith-machine-squat"))).toBe("BARBELL");
    expect(loadKindOf(subject("pushups"))).toBe("BODYWEIGHT");
  });

  it("knows which apparatus each one needs", () => {
    expect(exerciseGear(subject("hack-squat"))).toEqual(["hack-squat"]);
    expect(exerciseGear(subject("smith-machine-squat"))).toEqual(["smith"]);
    expect(exerciseGear(subject("wide-grip-lat-pulldown"))).toContain("lat-pulldown");
    expect(exerciseGear(subject("seated-cable-rows"))).toContain("low-row");
    expect(exerciseGear(subject("leg-extensions"))).toEqual(["leg-extension"]);
    expect(exerciseGear(subject("pushups"))).toEqual([]);
    expect(exerciseGear(subject("pullups"))).toEqual(["pull-up-bar"]);
  });
});

describe("blockingGear / isDoable", () => {
  it("blocks an exercise only when every gear it can be done on is missing", () => {
    const row = subject("hack-squat");
    expect(isDoable(row, [])).toBe(true);
    expect(blockingGear(row, ["hack-squat"])).toEqual(["hack-squat"]);
    expect(isDoable(row, new Set(["hack-squat"]))).toBe(false);
    // An anyOf exercise survives while one option remains.
    const seatedRow = subject("seated-cable-rows");
    const options = exerciseGear(seatedRow);
    if (options.length > 1) {
      expect(isDoable(seatedRow, [options[0]])).toBe(true);
      expect(isDoable(seatedRow, options)).toBe(false);
    }
    // Nothing to lack, nothing to block.
    expect(isDoable(subject("pushups"), GEAR_IDS)).toBe(true);
  });

  it("a stretch is never progressed in kg, whatever its equipment", () => {
    const stretch = catalog.find((e) => e.category === "STRETCHING");
    expect(stretch).toBeDefined();
    expect(loadKindOf({ slug: stretch!.slug, equipmentId: stretch!.equipment, category: "STRETCHING" })).toBe("NONE");
  });
});

describe("normalizeMissingGear / gearName", () => {
  it("keeps known, listed ids once, in catalog order", () => {
    expect(normalizeMissingGear(["smith", "hack-squat", "smith", "nope", "other-machine"])).toEqual(["hack-squat", "smith"]);
  });

  it("names gear the way the gym does", () => {
    expect(gearName("hack-squat")).toBe("Hack");
    expect(gearName("leg-extension")).toBe("Cadeira extensora");
    expect(gearName("unknown-id")).toBe("unknown-id");
  });
});
