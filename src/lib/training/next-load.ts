import { formatKg, formatNumber } from "@/lib/utils/format";
import {
  suggestProgression,
  type PerformedSet,
  type PrescribedSet,
  type ProgressionStrategy,
} from "./progression";

/**
 * The progression engine's verdict in the user's words: what to lift next
 * time for one exercise, and why. Used as the ghost value + chip in the set
 * table (from the last session) and as "Na próxima" in the summary (from the
 * session just finished). Never changes a load by itself — it only suggests.
 */
export interface NextLoadAdvice {
  kind: "increase" | "hold";
  /** Load to aim for (the ghost value in the kg box). */
  loadKg: number;
  /** Reps to aim for in each set, when the advice is about reps. */
  targetReps: number | null;
  /** Mono chip: "↑ Suba para 62,5 kg" / "Mantenha 60 kg · busque 9 reps". */
  headline: string;
  /** Why, in one short line: "8 reps em todas as séries". */
  reason: string;
}

export interface NextLoadInput {
  /** The program exercise's strategy; programs without one use double progression. */
  strategy: ProgressionStrategy | null | undefined;
  prescribed: PrescribedSet;
  /** Completed working sets (not extras, not warm-ups) of the reference session, in order. */
  sets: PerformedSet[];
  loadIncrementKg: number;
}

export function adviseNextLoad(input: NextLoadInput): NextLoadAdvice | null {
  const strategy = input.strategy ?? "DOUBLE";
  const increment = input.loadIncrementKg > 0 ? input.loadIncrementKg : 2.5;
  const s = suggestProgression(strategy, input.prescribed, input.sets, increment);
  const loads = input.sets.map((x) => x.weightKg ?? 0);
  const top = Math.max(0, ...loads);
  if (top <= 0) return null; // bodyweight or nothing usable: nothing to suggest about load
  const minReps = Math.min(...input.sets.map((x) => x.reps ?? 0));
  const { repMin, repMax, rirTarget } = input.prescribed;
  const rir = (n: number | undefined) => formatNumber(n ?? 0, 1);
  // Only mention RIR when the user actually logged it on every set.
  const rirLogged = input.sets.length > 0 && input.sets.every((x) => x.rir != null);

  switch (s.reasonKey) {
    case "at-rep-range-ceiling-with-target-rir":
    case "rir-higher-than-target-add-load":
    case "linear-hit-prescription": {
      // Exactly one step up from what was lifted (12 kg + 2,5 → 14,5 kg), never
      // snapped to a grid the equipment may not follow (12 → 15 would be +25%).
      const next = Math.round((top + increment) * 100) / 100;
      return {
        kind: "increase",
        loadKg: next,
        targetReps: repMin,
        headline: `↑ Suba para ${formatKg(next)}`,
        reason:
          s.reasonKey === "rir-higher-than-target-add-load"
            ? `Sobrou RIR ${rir(s.reasonData?.avgRir)} (alvo ${rir(s.reasonData?.targetRir)})`
            : s.reasonKey === "linear-hit-prescription"
              ? `${repMin}+ reps em todas as séries`
              : `${repMax} reps em todas as séries${rirTarget != null && rirLogged ? ` com RIR ≥ ${rir(rirTarget)}` : ""}`,
      };
    }
    case "within-rep-range-add-reps":
    case "rir-at-target-keep-load": {
      const target = Math.min(repMax, Math.max(repMin, minReps + 1));
      return {
        kind: "hold",
        loadKg: top,
        targetReps: target,
        headline: `Mantenha ${formatKg(top)} · busque ${target} reps`,
        reason: `Suba a carga quando fizer ${repMax} reps em todas`,
      };
    }
    case "incomplete-sets":
    case "linear-missed-prescription":
      return {
        kind: "hold",
        loadKg: top,
        targetReps: repMin,
        headline: `Mantenha ${formatKg(top)} · complete ${repMin} reps`,
        reason: `Alguma série ficou abaixo de ${repMin} reps`,
      };
    case "uneven-loads":
      return {
        kind: "hold",
        loadKg: top,
        targetReps: repMax,
        headline: `Mantenha ${formatKg(top)} · todas as séries com essa carga`,
        reason: `Suba quando fizer ${repMax} reps em todas as séries com ${formatKg(top)}`,
      };
    case "at-ceiling-rir-below-target":
      return {
        kind: "hold",
        loadKg: top,
        targetReps: repMax,
        headline: `Mantenha ${formatKg(top)} · ${repMax} reps com RIR ${rir(s.reasonData?.targetRir)}`,
        reason: `Fez ${repMax} reps em todas, mas com RIR ${rir(s.reasonData?.avgRir)} (alvo ${rir(s.reasonData?.targetRir)}) — suba quando sobrarem mais reps`,
      };
    case "rir-lower-than-target-keep-load":
      return {
        kind: "hold",
        loadKg: top,
        targetReps: null,
        headline: `Mantenha ${formatKg(top)}`,
        reason: `RIR ${rir(s.reasonData?.avgRir)}, abaixo do alvo ${rir(s.reasonData?.targetRir)}`,
      };
    default:
      return null; // no history / manual
  }
}

