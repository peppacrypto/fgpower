// alternatives.ts imports @/lib/db (eager Prisma client), so DATABASE_URL must
// be present for the module to load — these helpers themselves run no queries.
import "dotenv/config";
import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_FOR_ACCESS,
  adaptRepRange,
  assignStandIns,
  needsStandIn,
  rankStandIns,
  standInRange,
  type AdaptSwapRow,
  type AlternativeExercise,
  type Difficulty,
} from "./alternatives";

const alt = (id: string, difficulty: Difficulty, equipmentId: string | null = "dumbbell"): AlternativeExercise => ({
  id,
  slug: id,
  namePt: id,
  equipmentId,
  equipmentNamePt: equipmentId,
  imageUrl: null,
  difficulty,
  reason: "SAME_MUSCLE_PATTERN",
});

describe("rankStandIns", () => {
  it("floats not-harder options ahead of harder ones, stably", () => {
    const opts = [alt("nordic", "INTERMEDIATE"), alt("manual", "BEGINNER"), alt("floor", "INTERMEDIATE")];
    expect(rankStandIns(opts, "BEGINNER").map((o) => o.id)).toEqual(["manual", "nordic", "floor"]);
  });
  it("keeps order when none is harder", () => {
    const opts = [alt("a", "BEGINNER"), alt("b", "BEGINNER")];
    expect(rankStandIns(opts, "INTERMEDIATE").map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("adaptRepRange", () => {
  it("harder sub drops to the low end", () => {
    expect(adaptRepRange({ repMin: 10, repMax: 15 }, { originalDifficulty: "BEGINNER", substituteDifficulty: "INTERMEDIATE" })).toEqual({ repMin: 10, repMax: 10, shift: "harder" });
  });
  it("easier sub rises to the high end", () => {
    expect(adaptRepRange({ repMin: 6, repMax: 10 }, { originalDifficulty: "ADVANCED", substituteDifficulty: "BEGINNER" })).toEqual({ repMin: 10, repMax: 10, shift: "easier" });
  });
  it("same difficulty is untouched", () => {
    expect(adaptRepRange({ repMin: 8, repMax: 12 }, { originalDifficulty: "INTERMEDIATE", substituteDifficulty: "INTERMEDIATE" })).toEqual({ repMin: 8, repMax: 12, shift: null });
  });
});

describe("assignStandIns", () => {
  type Row = { repMin: number; repMax: number; tag: string };
  const row = (over: Partial<AdaptSwapRow<Row>> & { tag: string }): AdaptSwapRow<Row> => ({
    ex: { repMin: 8, repMax: 12, tag: over.tag },
    exerciseId: over.exerciseId ?? over.tag,
    usableNow: over.usableNow ?? false,
    difficulty: over.difficulty ?? "BEGINNER",
    candidates: over.candidates ?? [],
  });

  it("never proposes the same stand-in twice in a day", () => {
    const shared = alt("X", "BEGINNER");
    const other = alt("Y", "BEGINNER");
    const rows = [
      row({ tag: "r1", candidates: [shared, other] }), // many options
      row({ tag: "r2", candidates: [shared] }), // only X
    ];
    const out = assignStandIns(rows, 5);
    const picks = out.map((o) => o.pick?.id);
    expect(new Set(picks.filter(Boolean)).size).toBe(picks.filter(Boolean).length);
    // most-constrained (r2) keeps X; r1 takes Y
    expect(out[1].pick?.id).toBe("X");
    expect(out[0].pick?.id).toBe("Y");
  });

  it("leaves pick null (no reuse) when every candidate is taken", () => {
    const only = alt("Z", "BEGINNER");
    const out = assignStandIns([row({ tag: "r1", candidates: [only] }), row({ tag: "r2", candidates: [only] })], 5);
    expect(out.filter((o) => o.pick).length).toBe(1);
    expect(out.some((o) => o.kind === "swap" && !o.pick)).toBe(true);
  });

  it("reserves kept rows' ids so a swap can't collide with them", () => {
    const out = assignStandIns(
      [row({ tag: "keep1", exerciseId: "K", usableNow: true }), row({ tag: "r1", candidates: [alt("K", "BEGINNER"), alt("K2", "BEGINNER")] })],
      5,
    );
    expect(out[1].pick?.id).toBe("K2");
  });

  it("scales reps for a harder pick", () => {
    const out = assignStandIns([row({ tag: "r1", difficulty: "BEGINNER", candidates: [alt("hard", "INTERMEDIATE")] })], 5);
    expect(out[0].reps).toEqual({ repMin: 8, repMax: 8, shift: "harder" });
  });
});

describe("needsStandIn", () => {
  // Slugs the curated gear map never lists (it names catalog exercises only), so
  // each is judged by its catalog tag: a barbell lift needs the barbell, a
  // push-up nothing a gym could lack.
  const barbell = { slug: "zz-test-barbell-lift", equipmentId: "barbell" };
  const dumbbell = { slug: "zz-test-dumbbell-lift", equipmentId: "dumbbell" };
  const bodyweight = { slug: "zz-test-bodyweight", equipmentId: "bodyweight" };
  const fullGym = { allowed: null, missingGear: [] as string[] };

  it("leaves everything to a full gym with all its gear", () => {
    for (const ex of [barbell, dumbbell, bodyweight]) expect(needsStandIn(ex, fullGym)).toBe(false);
  });

  it("asks for one when every apparatus of it is missing from the gym", () => {
    expect(needsStandIn(barbell, { allowed: null, missingGear: ["barbell"] })).toBe(true);
    expect(needsStandIn(barbell, { allowed: null, missingGear: new Set(["barbell"]) })).toBe(true);
    expect(needsStandIn(dumbbell, { allowed: null, missingGear: ["barbell"] })).toBe(false);
    // Needing nothing, it is never blocked — whatever the gym lacks.
    expect(needsStandIn(bodyweight, { allowed: null, missingGear: ["barbell", "dumbbells", "pull-up-bar"] })).toBe(false);
  });

  it("still asks for one when the access level doesn't cover the equipment (unknown equipment included)", () => {
    const home = { allowed: EQUIPMENT_FOR_ACCESS.HOME_DUMBBELLS, missingGear: [] as string[] };
    expect(needsStandIn(barbell, home)).toBe(true);
    expect(needsStandIn(dumbbell, home)).toBe(false);
    expect(needsStandIn({ slug: "zz-test-untagged", equipmentId: null }, home)).toBe(true);
    // Both reasons at once: home dumbbells, but the dumbbells marked missing.
    expect(needsStandIn(dumbbell, { ...home, missingGear: ["dumbbells"] })).toBe(true);
  });
});

describe("standInRange", () => {
  const row = (over: Partial<{ repMin: number; repMax: number; notes: string | null; slug: string; difficulty: Difficulty }> = {}) => ({
    repMin: over.repMin ?? 8,
    repMax: over.repMax ?? 12,
    notes: over.notes ?? null,
    exercise: { slug: over.slug ?? "zz-test-squat", difficulty: over.difficulty ?? ("BEGINNER" as Difficulty) },
  });

  it("keeps the row's range for a stand-in of the same difficulty and unit", () => {
    expect(standInRange(row(), { slug: "zz-test-press", difficulty: "BEGINNER" })).toEqual({ repMin: 8, repMax: 12, shift: null });
  });

  it("collapses toward the end that fits a harder or easier stand-in", () => {
    expect(standInRange(row(), { slug: "zz-test-hard", difficulty: "ADVANCED" })).toEqual({ repMin: 8, repMax: 8, shift: "harder" });
    expect(standInRange(row({ difficulty: "INTERMEDIATE" }), { slug: "zz-test-easy", difficulty: "BEGINNER" })).toEqual({
      repMin: 12,
      repMax: 12,
      shift: "easier",
    });
  });

  it("takes the stand-in's default range across reps ↔ seconds, whatever the difficulty", () => {
    // A squat's 8–12 reps never become an 8–12 s plank.
    expect(standInRange(row(), { slug: "plank", difficulty: "ADVANCED" })).toEqual({ repMin: 20, repMax: 45, shift: "seconds" });
    // A hold — by its slug or by its note — goes back to reps.
    expect(standInRange(row({ slug: "plank", repMin: 30, repMax: 45 }), { slug: "zz-test-crunch", difficulty: "BEGINNER" })).toEqual({
      repMin: 8,
      repMax: 12,
      shift: "reps",
    });
    expect(
      standInRange(row({ notes: "Os números são o tempo em segundos.", repMin: 20, repMax: 30 }), { slug: "zz-test-crunch", difficulty: "BEGINNER" }),
    ).toEqual({ repMin: 8, repMax: 12, shift: "reps" });
    // Hold for hold: the row's own seconds stay.
    expect(standInRange(row({ slug: "plank", repMin: 30, repMax: 60 }), { slug: "side-bridge", difficulty: "BEGINNER" })).toEqual({
      repMin: 30,
      repMax: 60,
      shift: null,
    });
  });
});
