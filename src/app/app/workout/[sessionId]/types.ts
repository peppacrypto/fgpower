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
  /** Last time's completed working sets, in order (empty: never done before). */
  previousSets: { weightKg: number | null; reps: number | null; rir: number | null; isExtra: boolean }[];
  /** When that was, on the São Paulo calendar: { date: "16/09", ago: "há 9 dias" }. */
  lastTime: { date: string; ago: string } | null;
  /**
   * What to lift today, from last time's sets (lib/training/next-load via
   * adviceFromLastTime): the grey load/reps in the boxes and the chip under
   * "Último treino". Null without history or a load to judge.
   */
  advice: {
    kind: "increase" | "hold";
    loadKg: number;
    targetReps: number | null;
    headline: string;
    reason: string;
    /** "por quê?": the science page of the exercise's progression strategy. */
    whyHref: string | null;
  } | null;
  /** Progression rule of the program exercise (program's default, then double progression). */
  strategy: "DOUBLE" | "LINEAR_LOAD" | "REPETITION" | "RIR_BASED" | "MANUAL";
  /** The load step for this exercise (warm-up loads are rounded to it). */
  loadIncrementKg: number;
  /**
   * Done with the body's own weight (set-plan isBodyweightEquipment): kg is
   * extra load, 0 by default, so ✓ needs only the reps.
   */
  bodyweight: boolean;
  /** A hold whose "reps" are seconds (set-plan isTimedHold): "45 s", never "× 45". */
  timed: boolean;
  /**
   * What a set must beat to be a record (pr-moment recordBars: each load's
   * most reps and the best-1RM set in other finished workouts). Empty: never
   * done before — a baseline, no PR moment.
   */
  recordBars: { weightKg: number; reps: number }[];
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
  /** No workout finished yet: this is the user's very first. */
  firstWorkout: boolean;
  /**
   * What the user wrote about injuries/limitations at onboarding, echoed at
   * the top of their first few workouts; null afterwards or when empty.
   */
  limitations: string | null;
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
  /**
   * The program week this workout counts in and its guidance (W-054): the
   * header's "Sem. 5 · alvo RIR 1" and "Instruções da semana". Each
   * exercise's rirTarget already follows the week (its own target moved by
   * the wave, never below its floor: week-guidance weekRirTarget). Null
   * outside a program or without guidance for the week.
   */
  week: {
    /** "Sem. 5", "Sem. de entrada". */
    label: string;
    /** "Semana 5 de 13". */
    title: string;
    rirTarget: number | null;
    notePt: string | null;
    setsNotePt: string | null;
    deload: boolean;
    test: boolean;
  } | null;
}
