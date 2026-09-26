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
  /**
   * Server time just before this data was read. A set write the server
   * confirmed after this moment is newer than what these props show, so the
   * screen keeps its local copy of that row (see the drafts model).
   */
  loadedAtMs: number;
  notes: string | null;
  exercises: ExecutionExerciseLog[];
  /** Set when the user tried to start another day while this one is open. */
  notice: "em-andamento" | null;
  /** The user's program, for "Adicionar exercícios" when the day is empty. */
  programId: string | null;
  /** Play a short beep when a rest ends (Profile.restTimerSound). */
  restTimerSound: boolean;
  /**
   * Open since an earlier day or for over 8 h, and not a live session still
   * under 8 h (lib/training/stale.ts assessOpenSession showSince): the header
   * shows since when instead of the clock.
   */
  stale: {
    /** "sáb, 20/09", or "07:05" when opened earlier today. */
    since: string;
    /**
     * The day it would be saved as ("20/09") by "Salvar como feito em…": the
     * day its first bout of sets ended (staleSaveTiming). Null when that is
     * today — then there is nothing to backdate.
     */
    saveAsDay: string | null;
    /**
     * Untouched for 2 h+ (Today lists it as "não finalizado"): saving it on
     * its own day is the suggested finish. False once it was continued today —
     * then saving with today's date comes first and its own day stays offered.
     */
    leftOpen: boolean;
  } | null;
}
