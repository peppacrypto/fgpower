/**
 * Weekly sets per muscle for the builder's "Volume semanal" strip, computed
 * on the client while the program is being built (the program page's rules
 * only run after a save). Counting follows lib/programming/rules.ts: a set
 * counts in full for the muscles it trains directly and half for the ones
 * that assist, and a muscle hit directly and as an assistant by one exercise
 * counts once, directly. A program that repeats its days within the week
 * (A/B at 3×) or spreads them over two (8 days at 4×) is scaled by how often
 * each day comes around: sessions per week ÷ days.
 */
import { VOLUME_MUSCLES, type VolumeMuscleKey } from "./exercise-facets";

/** The range the strip draws as its guide band — weekly hard sets per muscle for hypertrophy. */
export const VOLUME_GUIDE = { min: 10, max: 20 } as const;

export interface VolumeExercise {
  sets: number;
  /** Null while the exercise's muscles are still loading (a draft restored from another visit). */
  primaryMuscleIds: string[] | null;
  secondaryMuscleIds: string[] | null;
}

export type VolumeStatus = "none" | "low" | "ok" | "high";

export interface VolumeRow {
  key: VolumeMuscleKey;
  label: string;
  /** Weekly sets: direct + half of the assisting ones, rounded to half a set. */
  sets: number;
  /** Weekly sets where it is a prime mover. */
  direct: number;
  status: VolumeStatus;
}

export interface WeeklyVolume {
  rows: VolumeRow[];
  /** How often each day comes around in a week. */
  perDay: number;
  /** Exercises whose muscles aren't known yet (not counted). */
  unknown: number;
}

const half = (n: number) => Math.round(n * 2) / 2;

function keysFor(muscleIds: string[]): Set<VolumeMuscleKey> {
  const keys = new Set<VolumeMuscleKey>();
  for (const m of VOLUME_MUSCLES) {
    if (m.muscleIds.some((id) => muscleIds.includes(id))) keys.add(m.key);
  }
  return keys;
}

export function volumeStatus(sets: number): VolumeStatus {
  if (sets <= 0) return "none";
  if (sets < VOLUME_GUIDE.min) return "low";
  if (sets > VOLUME_GUIDE.max) return "high";
  return "ok";
}

export function weeklyVolume(days: { exercises: VolumeExercise[] }[], sessionsPerWeek: number): WeeklyVolume {
  const perDay = days.length > 0 ? Math.max(0, sessionsPerWeek) / days.length : 0;
  const direct = new Map<VolumeMuscleKey, number>();
  const fractional = new Map<VolumeMuscleKey, number>();
  let unknown = 0;
  const add = (map: Map<VolumeMuscleKey, number>, key: VolumeMuscleKey, n: number) => map.set(key, (map.get(key) ?? 0) + n);

  for (const day of days) {
    for (const ex of day.exercises) {
      if (!ex.primaryMuscleIds || !ex.secondaryMuscleIds) {
        unknown++;
        continue;
      }
      const primary = keysFor(ex.primaryMuscleIds);
      for (const key of primary) {
        add(direct, key, ex.sets);
        add(fractional, key, ex.sets);
      }
      for (const key of keysFor(ex.secondaryMuscleIds)) {
        if (!primary.has(key)) add(fractional, key, ex.sets / 2);
      }
    }
  }

  const rows = VOLUME_MUSCLES.map((m) => {
    const sets = half((fractional.get(m.key) ?? 0) * perDay);
    return {
      key: m.key,
      label: m.label,
      sets,
      direct: half((direct.get(m.key) ?? 0) * perDay),
      status: volumeStatus(sets),
    };
  });
  return { rows, perDay, unknown };
}

/**
 * "3 abaixo · 1 acima" / "na faixa" — the strip's folded line, short enough
 * for a 320px phone. Muscles with no sets at all show only when it's open.
 */
export function volumeSummary(rows: VolumeRow[]): string {
  const trained = rows.filter((r) => r.status !== "none");
  if (trained.length === 0) return "sem exercícios";
  const low = rows.filter((r) => r.status === "low").length;
  const high = rows.filter((r) => r.status === "high").length;
  const parts = [low > 0 ? `${low} abaixo` : null, high > 0 ? `${high} acima` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "na faixa";
}
