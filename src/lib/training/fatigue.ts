import { formatKg, formatNumber, plural } from "@/lib/utils/format";
import { countsAsVolume } from "@/lib/programming/exercise-facets";
import { isTimedHold } from "./set-plan";

/**
 * The fatigue signal (W-128, decision 16: a suggestion only — nothing changes
 * until the user taps "Aplicar deload", and it can be undone). The GD
 * programs write their early-deload rule in every block: "metade das séries,
 * mesmas cargas, RIR 3-4, com 2+ gatilhos na mesma semana: reps caindo 2+ em
 * 2+ exercícios-chave por 2 sessões seguidas; dor articular ou muscular
 * > 72 h; < 6 h de sono em 3+ noites; estresse alto ou motivação baixa por 1
 * semana+". These pure rules read those triggers off the key exercises'
 * last sessions and the post-workout check-ins (W-127). Loaded by
 * lib/data/fatigue; unit-tested.
 */

/**
 * A GD key exercise's note: "Âncora do dia", "TOP SETS (âncora + benchmark)",
 * "Benchmark de puxada vertical". Unicode-aware word edges — a JS \b fails
 * on "Â" — so "ancoragem" never matches.
 */
export const ANCHOR_NOTE = /(?:^|[^\p{L}])(?:âncora|benchmark)(?![\p{L}])/iu;

/** At most this many key exercises are compared. */
const MAX_KEY_EXERCISES = 8;

export interface KeyExerciseCandidate {
  exerciseId: string;
  slug: string;
  notes: string | null;
  sortOrder: number;
  /** Exercise.category: a stretch or cardio is never a key exercise. */
  category?: string | null;
}

export interface KeyExercises {
  exerciseIds: string[];
  /** "anchors": the program marks them (GD); "first": each day's first exercise (any other program). */
  source: "anchors" | "first";
}

/**
 * The exercises whose reps are watched: the program's anchors and benchmarks
 * (notes matching ANCHOR_NOTE), deduped. With fewer than 2 of those, each
 * trainable day's first exercise that is neither a timed hold nor a stretch
 * or cardio. At most 8.
 */
export function keyExercises(days: readonly { exercises: readonly KeyExerciseCandidate[] }[]): KeyExercises {
  const trainable = days.filter((d) => d.exercises.length > 0);
  const anchors: string[] = [];
  for (const day of trainable) {
    for (const ex of [...day.exercises].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (ex.notes && ANCHOR_NOTE.test(ex.notes) && countsAsVolume(ex.category) && !anchors.includes(ex.exerciseId)) {
        anchors.push(ex.exerciseId);
      }
    }
  }
  if (anchors.length >= 2) return { exerciseIds: anchors.slice(0, MAX_KEY_EXERCISES), source: "anchors" };
  const firsts: string[] = [];
  for (const day of trainable) {
    const first = [...day.exercises]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((ex) => countsAsVolume(ex.category) && !isTimedHold({ slug: ex.slug, notes: ex.notes }));
    if (first && !firsts.includes(first.exerciseId)) firsts.push(first.exerciseId);
  }
  return { exerciseIds: firsts.slice(0, MAX_KEY_EXERCISES), source: "first" };
}

/** One session of a key exercise (lib/data/history SESSION_PERF_COLUMNS' top set and e1RM). */
export interface AnchorSession {
  date: Date;
  /** Heaviest load (0 = bodyweight) and the most reps done with it. */
  topKg: number;
  topReps: number;
  /** Best reliable e1RM (≤ 10 reps, load > 0). */
  e1rmKg: number | null;
}

const DAY_MS = 86_400_000;
/** The last session compared must be this recent: an old drop says nothing about this week. */
const RECENT_DAYS = 10;
const SAME_LOAD_KG = 0.01;
const REPS_DROP = 2;
const E1RM_DROP = 0.95;

/**
 * "Reps caindo 2+ … por 2 sessões seguidas": the last three sessions [ref,
 * a, b] of one key exercise, the last within 10 days. A session drops when,
 * at the reference's top load, it did 2+ fewer reps — or, at another load,
 * its e1RM fell 5% or more (GD 3/4's "ou e1RM 5% menor"). Both a and b must
 * drop: one bad day never counts. Returns the evidence line, or null.
 */
export function repsDrop(name: string, sessions: readonly AnchorSession[], now: Date): string | null {
  if (sessions.length < 3) return null;
  const [ref, a, b] = sessions.slice(-3);
  if (now.getTime() - b.date.getTime() > RECENT_DAYS * DAY_MS) return null;
  const sameLoad = (s: AnchorSession) => Math.abs(s.topKg - ref.topKg) < SAME_LOAD_KG;
  const drop = (s: AnchorSession) =>
    sameLoad(s)
      ? ref.topReps - s.topReps >= REPS_DROP
      : ref.e1rmKg != null && s.e1rmKg != null && ref.e1rmKg > 0
        ? s.e1rmKg <= E1RM_DROP * ref.e1rmKg
        : false;
  if (!drop(a) || !drop(b)) return null;
  const three = [ref, a, b];
  if (three.every(sameLoad)) {
    const load = ref.topKg > 0 ? `${formatKg(ref.topKg)}: ` : "";
    return `${name} (${load}${three.map((s) => s.topReps).join(" → ")})`;
  }
  if (three.every((s) => s.e1rmKg != null)) {
    return `${name} (1RM est. ${three.map((s) => formatNumber(s.e1rmKg, 1)).join(" → ")} kg)`;
  }
  return `${name} (${three.map((s) => `${formatKg(s.topKg)} × ${s.topReps}`).join(" → ")})`;
}

/** A post-workout check-in's answers (WorkoutSession, W-127). */
export interface CheckInAnswers {
  soreness: number | null;
  shortSleep: boolean;
  lingeringPain: boolean;
  highStress: boolean;
}

export type FatigueTriggerKey = "reps" | "pain" | "sleep" | "stress";

export interface FatigueTrigger {
  key: FatigueTriggerKey;
  /** The evidence, in a sentence ("Menos de 6 h de sono em 3 check-ins"). */
  text: string;
  /** How many key exercises (reps) or check-ins (the others) show it. */
  count: number;
}

/** Soreness from which a check-in counts toward the pain trigger. */
const SORE = 6;

const checkIns = (n: number) => plural(n, "check-in", "check-ins");

/**
 * The program's four triggers over the last 7 days:
 * - reps: 2+ key exercises dropping (repsDrop);
 * - pain: the "dor articular ou > 72 h" chip in any check-in, or soreness
 *   6+/10 in 2+ check-ins;
 * - sleep: "menos de 6 h" in 3+ check-ins (2+ on a plan of 3 days a week or
 *   fewer: fewer workouts, fewer chances to say so);
 * - stress: "estresse alto ou pouca motivação" in 2+ check-ins.
 */
export function detectFatigue(p: {
  anchors: readonly { name: string; sessions: readonly AnchorSession[] }[];
  checkIns: readonly CheckInAnswers[];
  daysPerWeek: number;
  now: Date;
}): FatigueTrigger[] {
  const triggers: FatigueTrigger[] = [];
  const drops = p.anchors.flatMap((a) => repsDrop(a.name, a.sessions, p.now) ?? []);
  if (drops.length >= 2) {
    triggers.push({
      key: "reps",
      text: `Reps caindo 2+ em ${drops.length} exercícios-chave por 2 sessões: ${drops.join("; ")}`,
      count: drops.length,
    });
  }
  const pain = p.checkIns.filter((c) => c.lingeringPain).length;
  const sore = p.checkIns.filter((c) => c.soreness != null && c.soreness >= SORE).length;
  if (pain >= 1) {
    triggers.push({ key: "pain", text: `Dor articular ou dor > 72 h marcada em ${checkIns(pain)}`, count: pain });
  } else if (sore >= 2) {
    triggers.push({ key: "pain", text: `Dor muscular ${SORE}+/10 em ${checkIns(sore)}`, count: sore });
  }
  const sleep = p.checkIns.filter((c) => c.shortSleep).length;
  if (sleep >= (p.daysPerWeek <= 3 ? 2 : 3)) {
    triggers.push({ key: "sleep", text: `Menos de 6 h de sono em ${checkIns(sleep)}`, count: sleep });
  }
  const stress = p.checkIns.filter((c) => c.highStress).length;
  if (stress >= 2) {
    triggers.push({ key: "stress", text: `Estresse alto ou pouca motivação em ${checkIns(stress)}`, count: stress });
  }
  return triggers;
}

export type FatigueLevel = "deload" | "deload-next" | "watch";

/**
 * What Today says: 2+ triggers → the program's rule suggests a deload
 * ("deload"), unless its own deload or test week comes next week anyway
 * ("deload-next": hold back until then); the reps trigger alone → "watch"
 * (the check-in holds the other three); nothing otherwise.
 */
export function fatigueLevel(triggers: readonly FatigueTrigger[], nextWeekIsLight: boolean): FatigueLevel | null {
  if (triggers.length >= 2) return nextWeekIsLight ? "deload-next" : "deload";
  if (triggers.length === 1 && triggers[0].key === "reps") return "watch";
  return null;
}

/** A deload week's working sets: half, rounded down, at least 1 (GD: "4 → 2; 3 ou 2 → 1"). */
export function deloadSets(n: number): number {
  return n <= 0 ? 0 : Math.max(1, Math.floor(n / 2));
}
