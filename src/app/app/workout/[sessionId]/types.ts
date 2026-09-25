export interface ExecutionSetLog {
  id: string;
  setNumber: number;
  setType: "WARMUP" | "WORKING" | "DROP" | "FAILURE";
  /** Added by the user beyond the prescription. */
  isExtra: boolean;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  isCompleted: boolean;
  notes: string | null;
}

export interface ExecutionExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  imageUrl: string | null;
  sortOrder: number;
  prescribedSets: number;
  warmupSets: number;
  repMin: number;
  repMax: number;
  rirTarget: number | null;
  restSeconds: number;
  wasSkipped: boolean;
  notes: string | null;
  persistentNote: string | null;
  sets: ExecutionSetLog[];
  previousSets: { weightKg: number | null; reps: number | null; rir: number | null; isExtra: boolean }[];
}

export interface ExecutionSession {
  id: string;
  name: string;
  startedAtIso: string;
  notes: string | null;
  exercises: ExecutionExerciseLog[];
  /** Set when the user tried to start another day while this one is open. */
  notice: "em-andamento" | null;
}
