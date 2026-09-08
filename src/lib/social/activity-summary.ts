import { sessionVolumeKg, workingSetCount } from "@/lib/training/volume";

interface SetLike {
  weightKg: number | null;
  reps: number | null;
  setType: "WARMUP" | "WORKING" | "DROP" | "FAILURE";
  isCompleted: boolean;
}

interface ExerciseLogLike {
  exercise: { namePt: string };
  sets: SetLike[];
}

interface RecordLike {
  exercise: { namePt: string };
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
  workingSets: number;
  bestSet: { weightKg: number; reps: number } | null;
}

export interface ActivityPrSummary {
  exerciseName: string;
  kind: RecordLike["kind"];
  value: number;
  weightKg: number | null;
  reps: number | null;
}

export interface WorkoutActivitySummary {
  workoutName: string;
  durationSeconds: number | null;
  totalWorkingSets: number;
  totalVolumeKg: number | null;
  exercises: ActivityExerciseSummary[];
  prs: ActivityPrSummary[];
}

/** Built ONLY from the session's own logged data — never fabricated (spec §46.5). */
export function buildWorkoutActivitySummary(session: SessionLike, showDetailedLoads: boolean): WorkoutActivitySummary {
  const allSets = session.exerciseLogs.flatMap((l) => l.sets);

  const exercises: ActivityExerciseSummary[] = session.exerciseLogs.map((log) => {
    const workingSets = log.sets.filter((s) => s.isCompleted && s.setType !== "WARMUP");
    const best = workingSets.reduce<SetLike | null>((acc, s) => {
      if (s.weightKg == null) return acc;
      if (!acc || (acc.weightKg ?? 0) < s.weightKg) return s;
      return acc;
    }, null);
    return {
      name: log.exercise.namePt,
      workingSets: workingSets.length,
      bestSet: showDetailedLoads && best?.weightKg != null && best.reps != null
        ? { weightKg: best.weightKg, reps: best.reps }
        : null,
    };
  });

  return {
    workoutName: session.name,
    durationSeconds: session.durationSeconds,
    totalWorkingSets: workingSetCount(allSets),
    totalVolumeKg: showDetailedLoads ? sessionVolumeKg(allSets) : null,
    exercises,
    prs: session.records.map((r) => ({
      exerciseName: r.exercise.namePt,
      kind: r.kind,
      value: r.value,
      weightKg: showDetailedLoads ? r.weightKg : null,
      reps: showDetailedLoads ? r.reps : null,
    })),
  };
}
