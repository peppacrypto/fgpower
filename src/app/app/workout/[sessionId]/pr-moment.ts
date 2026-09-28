import { estimate1Rm } from "@/lib/training/estimated-1rm";
import { detectExerciseRecords, type PriorSet } from "@/lib/training/personal-records-core";

/**
 * The PR moment in the workout (W-122): a ✓'d set that beats the user's real
 * record flashes a square "PR" on its row. Judged by the summary's own rules
 * (lib/training/personal-records-core): against the exercise's sets in other
 * COMPLETED sessions — none (a first time) is a baseline, never a record —
 * for load, estimated 1RM and reps at a load already used; never volume. A
 * set tied with an earlier one of this workout isn't a second record: the
 * first set to reach it carries it.
 */

const EPS = 1e-6;

/**
 * What a set has to beat, reduced to what the rules read: each load's most
 * reps, plus the set behind the best reliable estimated 1RM (a 100 kg × 8
 * under a 100 kg × 12 still sets the 1RM bar). Same verdicts as the full list.
 */
export function recordBars(prior: PriorSet[]): PriorSet[] {
  const byLoad = new Map<number, PriorSet>();
  let best1Rm: { value: number; set: PriorSet } | null = null;
  for (const p of prior) {
    if (!(Number.isFinite(p.weightKg) && p.weightKg >= 0 && Number.isInteger(p.reps) && p.reps >= 1)) continue;
    const key = Math.round(p.weightKg * 1000);
    const at = byLoad.get(key);
    if (!at || p.reps > at.reps) byLoad.set(key, { weightKg: p.weightKg, reps: p.reps });
    const est = estimate1Rm(p.weightKg, p.reps);
    if (est.reliable && est.epleyKg != null && (!best1Rm || est.epleyKg > best1Rm.value)) {
      best1Rm = { value: est.epleyKg, set: p };
    }
  }
  const out = [...byLoad.values()];
  if (best1Rm && !out.some((p) => Math.abs(p.weightKg - best1Rm.set.weightKg) < EPS && p.reps === best1Rm.set.reps)) {
    out.push({ weightKg: best1Rm.set.weightKg, reps: best1Rm.set.reps });
  }
  return out;
}

/**
 * Which of an exercise's ✓'d working sets (in the order they appear) is a
 * record: each against `bars` (other sessions) plus the sets ✓'d before it
 * here. Empty `bars`: a first time — no records. Returns the row ids.
 */
export function recordRows(bars: PriorSet[], rows: { id: string; weightKg: number | null; reps: number | null }[]): Set<string> {
  const out = new Set<string>();
  if (bars.length === 0) return out;
  const before: PriorSet[] = [...bars];
  for (const r of rows) {
    if (r.weightKg == null || r.reps == null || !(r.reps >= 1)) continue;
    const set = { id: r.id, weightKg: r.weightKg, reps: Math.round(r.reps) };
    if (detectExerciseRecords([set], before).records.length > 0) out.add(r.id);
    before.push({ weightKg: set.weightKg, reps: set.reps });
  }
  return out;
}
