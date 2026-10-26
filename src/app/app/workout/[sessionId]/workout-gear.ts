/**
 * The workout's side of Minha academia, read on the server (the workout page
 * and its summary): the apparatus each exercise is done on, and which program
 * slot a log is — what "Trocar no plano" (applySwapToPlan) changes. Pure.
 */
import { GEAR, exerciseGear, gearName, type GearSubject } from "@/lib/exercises/gear";

/** Gear a user can mark as missing (Settings → Minha academia lists it). */
const LISTED_GEAR = new Set<string>(GEAR.filter((g) => g.listed).map((g) => g.id));

/**
 * The apparatus an exercise can be done on, any one of them, as the workout
 * shows it — each with whether the user's gym lacks it. Empty when it needs
 * nothing a gym could lack, and when one option is a catch-all no one can
 * mark ("Outra máquina": an exercise the curated map doesn't know) — that one
 * is never missing, so there is nothing to note and nothing to replace.
 */
export function gearOf(
  subject: GearSubject,
  missing: ReadonlySet<string>,
): { id: string; namePt: string; missing: boolean }[] {
  const ids = exerciseGear(subject);
  if (!ids.every((id) => LISTED_GEAR.has(id))) return [];
  return ids.map((id) => ({ id, namePt: gearName(id), missing: missing.has(id) }));
}

/** What a workout's exercise log says about the plan. */
export interface SlotLog {
  exerciseId: string;
  /** The program's exercise it replaced mid-workout (W-006), or null. */
  substitutedFromExerciseId: string | null;
  /** Its program row, when the day prescribed it. */
  programExercise: object | null;
}

/**
 * Which of a workout's logs (in workout order) holds the program slot that
 * `logs[index]` is or stands in for: itself when the day prescribed it;
 * else — a stand-in added after an exercise that already had sets, which has
 * no program row of its own — the nearest earlier log of the program that
 * held, or stood for, the exercise it replaced. Null: an exercise added to the
 * workout, in no plan. applySwapToPlan resolves the same slot on the server.
 */
export function planSlotIndex(logs: readonly SlotLog[], index: number): number | null {
  const log = logs[index];
  if (!log) return null;
  if (log.programExercise !== null) return index;
  const asked = log.substitutedFromExerciseId;
  if (asked === null) return null;
  for (let i = index - 1; i >= 0; i--) {
    const o = logs[i];
    if (o.programExercise !== null && (o.exerciseId === asked || o.substitutedFromExerciseId === asked)) return i;
  }
  return null;
}
