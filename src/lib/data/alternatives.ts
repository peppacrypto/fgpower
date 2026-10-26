import "server-only";
import { prisma } from "@/lib/db";
import { blockingGear, type GearSubject } from "@/lib/exercises/gear";
import { defaultRange, isTimedHold } from "@/lib/training/set-plan";

/**
 * Exercises that can stand in for another one — for "Trocar" mid-workout
 * (machine taken, no such equipment), "Adaptar para halteres" on a program and
 * "Ajustar à minha academia" on the user's own. Curated relations
 * (ExerciseRelation ALTERNATIVE / REGRESSION) come first; the rest are the
 * closest matches by the same primary muscle and movement pattern (a lift for
 * a lift), filtered to equipment the user can use — their access level, and
 * the gear their gym has (Settings → Minha academia). Never the exercise itself.
 */

/**
 * Equipment a user with each access level can use (Equipment.id) — what they
 * said in onboarding: "Halteres em casa" is "halteres e talvez um banco", so
 * no pull-up bar, kettlebell or Swiss ball is taken for granted.
 */
export const EQUIPMENT_FOR_ACCESS: Record<string, string[] | null> = {
  FULL_GYM: null, // everything
  HOME_DUMBBELLS: ["dumbbell", "bench", "bodyweight", "none"],
  HOME_BODYWEIGHT: ["bodyweight", "none", "pull-up-bar"],
  MINIMAL: ["bodyweight", "none", "resistance-band", "dumbbell", "kettlebell"],
};

/**
 * The gear an access level is built around, when it has one: "Adaptar para
 * halteres" should default to the dumbbell squat, not to a bodyweight squat
 * that happens to be more popular.
 */
const MAIN_EQUIPMENT_FOR_ACCESS: Record<string, readonly string[]> = {
  HOME_DUMBBELLS: ["dumbbell"],
  MINIMAL: ["kettlebell", "dumbbell", "resistance-band"],
};

/** Stand-ins with the access level's main gear first; otherwise in the order given (stable). */
export function mainGearFirst<T extends { equipmentId: string | null }>(options: T[], equipmentAccess: string | null): T[] {
  const main = MAIN_EQUIPMENT_FOR_ACCESS[equipmentAccess ?? "FULL_GYM"];
  if (!main) return options;
  const rank = (o: T) => (o.equipmentId !== null && main.includes(o.equipmentId) ? 0 : 1);
  return [...options].sort((a, b) => rank(a) - rank(b));
}

/**
 * Whether a plan's exercise is out of the user's reach and needs a stand-in:
 * its equipment isn't one their access level covers (`allowed`, an
 * EQUIPMENT_FOR_ACCESS list — null for a full gym), or every apparatus it can
 * be done on is one their gym doesn't have (`missingGear`, Profile.missingGear —
 * lib/exercises/gear blockingGear). What "Adaptar", the onboarding's auto-adapt,
 * "Ajustar à minha academia" and every stand-in list judge an exercise by.
 */
export function needsStandIn(
  ex: GearSubject,
  ctx: { allowed: readonly string[] | null; missingGear: readonly string[] | ReadonlySet<string> },
): boolean {
  if (ctx.allowed !== null && (ex.equipmentId === null || !ctx.allowed.includes(ex.equipmentId))) return true;
  return blockingGear(ex, ctx.missingGear).length > 0;
}

/**
 * A template row as the "Adaptar" review names it (`swap:<key>`): its day,
 * place and exercise. A reseed keeps all three, while it recreates the row
 * ids; a different exercise at that place means the template changed.
 */
export function adaptRowKey(dayIndex: number, row: { sortOrder: number; exerciseId: string }): string {
  return `${dayIndex}:${row.sortOrder}:${row.exerciseId}`;
}

/**
 * Categories that stand in for one another. A lift's stand-in is a lift: a
 * sprint drill or a kettlebell swing works the hamstrings too, but it doesn't
 * replace a leg curl.
 */
const LIFTS = ["STRENGTH", "POWERLIFTING", "OLYMPIC_WEIGHTLIFTING", "STRONGMAN"] as const;

export interface AlternativeExercise {
  id: string;
  slug: string;
  namePt: string;
  equipmentId: string | null;
  equipmentNamePt: string | null;
  imageUrl: string | null;
  /** Catalog difficulty, for ranking stand-ins and scaling reps. */
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  /** Why it was offered: a curated relation, or the same muscle + pattern. */
  reason: "ALTERNATIVE" | "REGRESSION" | "PROGRESSION" | "SAME_MUSCLE_PATTERN" | "SAME_MUSCLE";
}

/**
 * How many pages of a catalog query (`limit * 2` rows each) a stand-in list may
 * read. One is the old behaviour, enough while only the access level filters
 * (it is part of the query); with gear missing, the gym's filter runs on the
 * rows read (the gear map is code — lib/exercises/gear), so a gym without the
 * popular machines reads on until the list fills or the catalog runs out.
 */
const MAX_PAGES_WITH_GEAR_MISSING = 5;

export async function getAlternatives(
  exerciseId: string,
  opts: {
    equipmentAccess?: string | null;
    /** Profile.missingGear: never offer an exercise every apparatus of which the gym lacks. */
    missingGear?: readonly string[];
    limit?: number;
    excludeIds?: string[];
  } = {},
): Promise<AlternativeExercise[]> {
  const limit = opts.limit ?? 12;
  const allowed = EQUIPMENT_FOR_ACCESS[opts.equipmentAccess ?? "FULL_GYM"] ?? null;
  const missingGear = new Set(opts.missingGear ?? []);
  const exclude = new Set([exerciseId, ...(opts.excludeIds ?? [])]);

  const base = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: {
      category: true,
      movementPatternId: true,
      muscles: { where: { role: "PRIMARY" }, select: { muscleId: true } },
      relationsFrom: {
        where: { kind: { in: ["ALTERNATIVE", "REGRESSION", "PROGRESSION"] } },
        orderBy: { sortOrder: "asc" },
        select: { kind: true, relatedExerciseId: true },
      },
    },
  });
  if (!base) return [];

  const select = {
    id: true,
    slug: true,
    namePt: true,
    equipmentId: true,
    // What the gym's gear is judged on (lib/exercises/gear GearSubject).
    category: true,
    difficulty: true,
    equipment: { select: { namePt: true } },
    media: { take: 1, orderBy: { sortOrder: "asc" as const }, select: { url: true } },
  };
  type Row = {
    id: string;
    slug: string;
    namePt: string;
    equipmentId: string | null;
    category: string;
    difficulty: AlternativeExercise["difficulty"];
    equipment: { namePt: string } | null;
    media: { url: string }[];
  };
  const out: AlternativeExercise[] = [];
  const push = (e: Row, reason: AlternativeExercise["reason"]) => {
    if (exclude.has(e.id) || out.length >= limit || needsStandIn(e, { allowed, missingGear })) return;
    exclude.add(e.id);
    out.push({
      id: e.id,
      slug: e.slug,
      namePt: e.namePt,
      equipmentId: e.equipmentId,
      equipmentNamePt: e.equipment?.namePt ?? null,
      imageUrl: e.media[0]?.url ?? null,
      difficulty: e.difficulty,
      reason,
    });
  };

  // 1. Curated relations, in their order.
  if (base.relationsFrom.length > 0) {
    const related = await prisma.exercise.findMany({
      where: { id: { in: base.relationsFrom.map((r) => r.relatedExerciseId) }, isPublished: true },
      select,
    });
    const byId = new Map(related.map((r) => [r.id, r]));
    for (const r of base.relationsFrom) {
      const e = byId.get(r.relatedExerciseId);
      if (e) push(e, r.kind);
    }
  }

  // 2. Same primary muscle and movement pattern, then same primary muscle — most used first.
  const primary = base.muscles.map((m) => m.muscleId);
  if (primary.length > 0 && out.length < limit) {
    const isLift = (LIFTS as readonly string[]).includes(base.category);
    const common = {
      isPublished: true,
      category: isLift ? { in: [...LIFTS] } : { not: "STRETCHING" as const },
      // Nor is a clean or a snatch — a skill lift — unless it replaces one.
      ...(base.movementPatternId !== "olympic" ? { OR: [{ movementPatternId: null }, { movementPatternId: { not: "olympic" } }] } : {}),
      muscles: { some: { role: "PRIMARY" as const, muscleId: { in: primary } } },
      ...(allowed ? { equipmentId: { in: allowed } } : {}),
    };
    // Page by page while the gym's gear filters out what was read (see
    // MAX_PAGES_WITH_GEAR_MISSING); the id breaks popularity/name ties so no
    // row is skipped or read twice across pages.
    const pageSize = limit * 2;
    const pages = missingGear.size > 0 ? MAX_PAGES_WITH_GEAR_MISSING : 1;
    const fill = async (where: typeof common & { movementPatternId?: string }, reason: AlternativeExercise["reason"]) => {
      for (let page = 0; page < pages && out.length < limit; page++) {
        const rows = await prisma.exercise.findMany({
          where,
          orderBy: [{ popularity: "desc" }, { namePt: "asc" }, { id: "asc" }],
          skip: page * pageSize,
          take: pageSize,
          select,
        });
        for (const e of rows) push(e, reason);
        if (rows.length < pageSize) return;
      }
    };
    if (base.movementPatternId) await fill({ ...common, movementPatternId: base.movementPatternId }, "SAME_MUSCLE_PATTERN");
    if (out.length < limit) await fill(common, "SAME_MUSCLE");
  }
  return out;
}

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
const DIFFICULTY_RANK: Record<Difficulty, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

/** Equipment that can be loaded lighter to hit a rep target. Bodyweight / none cannot. */
const LOADABLE_EQUIPMENT = new Set(["dumbbell", "kettlebell", "barbell", "machine", "cable", "resistance-band", "smith-machine", "ez-bar", "trap-bar", "weighted"]);
export const isLoadable = (equipmentId: string | null): boolean => equipmentId !== null && LOADABLE_EQUIPMENT.has(equipmentId);

/**
 * Stable reorder that keeps `mainGearFirst` order but floats stand-ins that are
 * NOT harder than the row's own exercise ahead of harder ones, so "Adaptar"
 * never reaches for a far-harder variant (e.g. a Nordic curl) when a gentler
 * one with the same equipment exists.
 */
export function rankStandIns<T extends { equipmentId: string | null; difficulty: Difficulty }>(options: T[], originalDifficulty: Difficulty): T[] {
  const origRank = DIFFICULTY_RANK[originalDifficulty];
  const notHarder = (o: T) => (DIFFICULTY_RANK[o.difficulty] <= origRank ? 0 : 1);
  return [...options].sort((a, b) => notHarder(a) - notHarder(b));
}

export interface AdaptedReps {
  repMin: number;
  repMax: number;
  /** "harder" | "easier" | null — drives the pt-BR note; null means unchanged. */
  shift: "harder" | "easier" | null;
}

/**
 * Collapse the plan's own rep range toward the end that fits a stand-in of a
 * different difficulty — never invents numbers. A harder stand-in gets the
 * bottom of the range (and, when it can't be loaded lighter, a "stop ~1-2 shy"
 * cue); an easier one gets the top. Equal difficulty is left untouched.
 */
export function adaptRepRange(
  range: { repMin: number; repMax: number },
  opts: { originalDifficulty: Difficulty; substituteDifficulty: Difficulty },
): AdaptedReps {
  const delta = DIFFICULTY_RANK[opts.substituteDifficulty] - DIFFICULTY_RANK[opts.originalDifficulty];
  if (delta >= 1) return { repMin: range.repMin, repMax: range.repMin, shift: "harder" };
  if (delta <= -1) return { repMin: range.repMax, repMax: range.repMax, shift: "easier" };
  return { repMin: range.repMin, repMax: range.repMax, shift: null };
}

export interface StandInRange {
  repMin: number;
  repMax: number;
  /**
   * "harder" | "easier" as adaptRepRange; "seconds" / "reps" when the swap
   * crosses between a timed hold and a counted exercise (the new one's default
   * range); null when the row's range is kept as it is.
   */
  shift: AdaptedReps["shift"] | "seconds" | "reps";
}

/**
 * The range a program row takes on when a stand-in replaces its exercise for
 * good ("Ajustar à minha academia"), as keepSwapInProgram writes it: across a
 * reps↔seconds change, the stand-in's default range (an 8–12 rep range must
 * not become an 8–12 s plank, A-058 — the row's note goes with the swap, so
 * the stand-in is judged by its slug alone); otherwise the row's own range,
 * collapsed toward the end that fits a stand-in of another difficulty
 * (adaptRepRange).
 */
export function standInRange(
  row: { repMin: number; repMax: number; notes: string | null; exercise: { slug: string; difficulty: Difficulty } },
  sub: { slug: string; difficulty: Difficulty },
): StandInRange {
  const wasTimed = isTimedHold({ slug: row.exercise.slug, notes: row.notes });
  const timed = isTimedHold({ slug: sub.slug });
  if (wasTimed !== timed) return { ...defaultRange(timed), shift: timed ? "seconds" : "reps" };
  return adaptRepRange(
    { repMin: row.repMin, repMax: row.repMax },
    { originalDifficulty: row.exercise.difficulty, substituteDifficulty: sub.difficulty },
  );
}

export interface AdaptSwapRow<Ex> {
  ex: Ex;
  exerciseId: string;
  usableNow: boolean;
  difficulty: Difficulty;
  candidates: AlternativeExercise[];
}
export interface AdaptAssignment<Ex> {
  ex: Ex;
  kind: "keep" | "swap";
  pick: AlternativeExercise | null;
  options: AlternativeExercise[];
  reps: AdaptedReps | null;
}

/**
 * Pure per-day assignment: most-constrained row first, never the same stand-in
 * twice in a day, and the rep range scaled for a stand-in of a different
 * difficulty. `candidates` must already be `rankStandIns(mainGearFirst(...))`.
 */
export function assignStandIns<Ex extends { repMin: number; repMax: number }>(
  rows: AdaptSwapRow<Ex>[],
  optionsLimit: number,
): AdaptAssignment<Ex>[] {
  const used = new Set<string>();
  for (const r of rows) if (r.usableNow) used.add(r.exerciseId);
  const picks = new Map<AdaptSwapRow<Ex>, AlternativeExercise | null>();
  const order = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.usableNow)
    .sort((a, b) => a.r.candidates.length - b.r.candidates.length || a.i - b.i);
  for (const { r } of order) {
    const pick = r.candidates.find((c) => !used.has(c.id)) ?? null;
    if (pick) used.add(pick.id);
    picks.set(r, pick);
  }
  return rows.map((r) => {
    if (r.usableNow) return { ex: r.ex, kind: "keep", pick: null, options: [], reps: null };
    const pick = picks.get(r) ?? null;
    const options = pick ? [pick, ...r.candidates.filter((c) => c.id !== pick.id)].slice(0, optionsLimit) : [];
    const reps = pick
      ? adaptRepRange({ repMin: r.ex.repMin, repMax: r.ex.repMax }, { originalDifficulty: r.difficulty, substituteDifficulty: pick.difficulty })
      : null;
    return { ex: r.ex, kind: "swap", pick, options, reps };
  });
}
