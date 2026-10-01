import { sessionVolumeKg, workingSetCount } from "@/lib/training/volume";
import { groupRecordsByExercise, isShownPrKind } from "@/lib/training/personal-records-core";
import { isTimedHold } from "@/lib/training/set-plan";

interface SetLike {
  weightKg: number | null;
  reps: number | null;
  setType: "WARMUP" | "WORKING" | "DROP" | "FAILURE";
  isCompleted: boolean;
}

interface ExerciseLogLike {
  exerciseId?: string;
  /** The slug tells a hold whose "reps" are seconds (set-plan isTimedHold). */
  exercise: { namePt: string; slug?: string };
  /** The prescription's note, which can say the numbers are seconds. */
  notes?: string | null;
  sets: SetLike[];
}

interface RecordLike {
  exerciseId?: string;
  exercise: { namePt: string; slug?: string };
  kind: "MAX_WEIGHT" | "ESTIMATED_1RM" | "MAX_REPS_AT_WEIGHT" | "SESSION_VOLUME";
  value: number;
  weightKg: number | null;
  reps: number | null;
}

interface SessionLike {
  name: string;
  durationSeconds: number | null;
  exerciseLogs: ExerciseLogLike[];
  records: RecordLike[];
}

export interface ActivityExerciseSummary {
  name: string;
  /** Absent in summaries stored before it existed. */
  slug?: string;
  /**
   * A hold whose "reps" are seconds (L-bodyweight-timed-display): print its
   * sets with formatSet(…, { timed }) — "45 s", "10 kg × 40 s", never "0 kg × 45".
   * Absent in older summaries: reps.
   */
  timed?: boolean;
  workingSets: number;
  bestSet: { weightKg: number; reps: number } | null;
}

export interface ActivityPrSummary {
  exerciseName: string;
  kind: RecordLike["kind"];
  /** Null when loads are hidden and the value is a load (weight, e1RM). */
  value: number | null;
  weightKg: number | null;
  reps: number | null;
  /** The record's exercise is a timed hold: its reps are seconds (describePr's `timed`). Absent in older summaries. */
  timed?: boolean;
}

export interface WorkoutActivitySummary {
  workoutName: string;
  durationSeconds: number | null;
  totalWorkingSets: number;
  totalVolumeKg: number | null;
  exercises: ActivityExerciseSummary[];
  /**
   * The session's records, grouped by exercise in workout order. Summaries
   * stored before records got their baseline rule can still hold
   * SESSION_VOLUME entries: readers filter with isShownPrKind.
   */
  prs: ActivityPrSummary[];
}

/** Built ONLY from the session's own logged data — never fabricated (spec §46.5). */
export function buildWorkoutActivitySummary(session: SessionLike, showDetailedLoads: boolean): WorkoutActivitySummary {
  const allSets = session.exerciseLogs.flatMap((l) => l.sets);

  // Exercises with nothing done (skipped) aren't part of what was trained.
  const exercises: ActivityExerciseSummary[] = session.exerciseLogs.flatMap((log) => {
    const workingSets = log.sets.filter((s) => s.isCompleted && s.setType !== "WARMUP");
    // The heaviest set; at one load, the one with the most reps (40 × 11 over 40 × 10).
    const best = workingSets.reduce<SetLike | null>((acc, s) => {
      if (s.weightKg == null) return acc;
      if (!acc || (acc.weightKg ?? 0) < s.weightKg) return s;
      if ((acc.weightKg ?? 0) === s.weightKg && (s.reps ?? 0) > (acc.reps ?? 0)) return s;
      return acc;
    }, null);
    if (workingSets.length === 0) return [];
    const slug = log.exercise.slug;
    return [
      {
        name: log.exercise.namePt,
        ...(slug ? { slug } : {}),
        timed: isTimedHold({ slug, notes: log.notes }),
        workingSets: workingSets.length,
        bestSet:
          showDetailedLoads && best?.weightKg != null && best.reps != null
            ? { weightKg: best.weightKg, reps: best.reps }
            : null,
      },
    ];
  });

  const keyOf = (r: { exerciseId?: string; exercise: { namePt: string } }) => r.exerciseId ?? r.exercise.namePt;
  const order = session.exerciseLogs.map(keyOf);
  // A record is timed when its exercise was in this workout as a hold (its note may say so), or is a known hold.
  const timedByKey = new Map(session.exerciseLogs.map((l) => [keyOf(l), isTimedHold({ slug: l.exercise.slug, notes: l.notes })]));
  const prs = groupRecordsByExercise(session.records.filter((r) => isShownPrKind(r.kind)), keyOf, order)
    .flatMap((g) => g.records)
    .map((r) => ({
      exerciseName: r.exercise.namePt,
      kind: r.kind,
      // A rep count isn't a load; weights and e1RMs stay hidden with the loads.
      value: showDetailedLoads || r.kind === "MAX_REPS_AT_WEIGHT" ? r.value : null,
      weightKg: showDetailedLoads ? r.weightKg : null,
      reps: showDetailedLoads || r.kind === "MAX_REPS_AT_WEIGHT" ? r.reps : null,
      timed: timedByKey.get(keyOf(r)) ?? isTimedHold({ slug: r.exercise.slug }),
    }));

  return {
    workoutName: session.name,
    durationSeconds: session.durationSeconds,
    totalWorkingSets: workingSetCount(allSets),
    totalVolumeKg: showDetailedLoads ? sessionVolumeKg(allSets) : null,
    exercises,
    prs,
  };
}

/** What a feed card shows of a stored summary — and all it ever receives. */
export interface ActivityCardSummary {
  workoutName: string;
  durationSeconds: number | null;
  totalWorkingSets: number;
  totalVolumeKg: number | null;
  /** Exercises with a record, once each, in workout order. */
  prNames: string[];
}

/**
 * Trims a stored summary to what the card shows, on the server, before it goes
 * to the (client) card: exercise names for the record badges, never their
 * values. Summaries stored before loads were stripped from records still hold
 * weights and e1RMs in prs[].value even with the loads hidden — those must
 * not reach a follower's or signed-out browser. With the loads hidden
 * (`showDetailedLoads` false) the volume goes too; stored summaries already
 * leave it null then.
 */
export function toCardSummary(summary: unknown, showDetailedLoads?: boolean): ActivityCardSummary {
  const s = (summary ?? {}) as Partial<WorkoutActivitySummary>;
  const prs = Array.isArray(s.prs) ? s.prs : [];
  const volume = typeof s.totalVolumeKg === "number" ? s.totalVolumeKg : null;
  return {
    workoutName: typeof s.workoutName === "string" ? s.workoutName : "Treino",
    durationSeconds: typeof s.durationSeconds === "number" ? s.durationSeconds : null,
    totalWorkingSets: typeof s.totalWorkingSets === "number" ? s.totalWorkingSets : 0,
    totalVolumeKg: showDetailedLoads === false ? null : volume,
    prNames: [
      ...new Set(
        prs.filter((pr) => pr && isShownPrKind(pr.kind) && typeof pr.exerciseName === "string").map((pr) => pr.exerciseName),
      ),
    ],
  };
}
