// alternatives.ts imports @/lib/db (eager Prisma client), so DATABASE_URL must
// be present for the module to load — these helpers themselves run no queries.
import "dotenv/config";
import { describe, expect, it } from "vitest";
import {
  adaptRepRange,
  assignStandIns,
  rankStandIns,
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
