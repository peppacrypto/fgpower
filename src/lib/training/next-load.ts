import { formatKg, formatNumber } from "@/lib/utils/format";
import {
  extendedRepCap,
  nextLoadDown,
  nextLoadUp,
  predictedRepsAt,
  repsNeededFor,
  type LoadGrid,
} from "./load-grid";
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
 *
 * Loads move along the exercise's real grid (lib/training/load-grid): the
 * next dumbbell on the rack, one more plate of the stack. Where that jump is
 * too coarse for the rep range, it asks for more reps first, and where a jump
 * left the sets below the range, one step back (P18).
 */
export interface NextLoadAdvice {
  kind: "increase" | "hold" | "decrease";
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
  /** The loads this exercise can be done with (load-grid loadGridFor). */
  grid: LoadGrid;
  /**
   * How far the rep range may stretch before a coarse jump (load-grid
   * extendedRepCap — 30 for calves and lateral raises); from repMax when absent.
   */
  repCap?: number;
  /** A timed hold: its "reps" are seconds, so the advice is worded for seconds (set-plan's adviceInSeconds). */
  timed?: boolean;
}

/** Reps in reserve the sets were done at: what the user logged, else the target, else 2. */
function effortOf(sets: PerformedSet[], rirTarget: number | null): number {
  const logged = sets.filter((s) => s.rir != null);
  if (sets.length > 0 && logged.length === sets.length) {
    return logged.reduce((sum, s) => sum + (s.rir as number), 0) / logged.length;
  }
  return rirTarget ?? 2;
}

/** "+12,5%" — how big a jump is, relative to the load it starts from. */
function jumpText(from: number, to: number): string {
  return `+${formatNumber(((to - from) / from) * 100, 1)}%`;
}

export function adviseNextLoad(input: NextLoadInput): NextLoadAdvice | null {
  const strategy = input.strategy ?? "DOUBLE";
  const loads = input.sets.map((x) => x.weightKg ?? 0);
  const top = Math.max(0, ...loads);
  if (top <= 0) return null; // bodyweight or nothing usable: nothing to suggest about load
  const grid = input.grid;
  const next = nextLoadUp(grid, top);
  const s = suggestProgression(strategy, input.prescribed, input.sets, next !== null ? next - top : 0);
  const minReps = Math.min(...input.sets.map((x) => x.reps ?? 0));
  const { repMin, repMax, rirTarget } = input.prescribed;
  const rir = (n: number | undefined) => formatNumber(n ?? 0, 1);
  // Only mention RIR when the user actually logged it on every set.
  const rirLogged = input.sets.length > 0 && input.sets.every((x) => x.rir != null);
  const effort = effortOf(input.sets, rirTarget);
  const cap = input.repCap ?? extendedRepCap(repMax);
  // Seconds don't follow the reps↔load curve: a timed hold just moves along the grid.
  // Nor does extra load on the body's own weight: 2,5 kg on a dip belt is a few % of
  // what is lifted, not the +25% the belt's 10 kg would make it look like.
  const coarseRule = strategy === "DOUBLE" && !input.timed && grid.kind !== "BODYWEIGHT";

  /**
   * The reps at `top` that make the next load fit the range (P18): the top
   * of the range when the jump is small enough, more when it is coarse (8 →
   * 9 kg on a lateral raise), never past `cap`. Null without a next load.
   */
  const unlockReps = (): number | null => {
    if (next === null) return null;
    if (!coarseRule) return repMax;
    return Math.max(repMax, Math.min(cap, repsNeededFor(next, top, repMin, effort)));
  };

  switch (s.reasonKey) {
    case "at-rep-range-ceiling-with-target-rir":
    case "rir-higher-than-target-add-load":
    case "linear-hit-prescription": {
      if (next === null) {
        // Bands, cardio, rollers: there is no heavier one to go to — more reps instead.
        const more = Math.min(cap, Math.max(repMax, minReps) + 1);
        return {
          kind: "hold",
          loadKg: top,
          targetReps: more,
          headline: `Mantenha ${formatKg(top)} · busque ${more} reps`,
          reason: "Sem um próximo peso neste equipamento: progrida nas reps",
        };
      }
      if (coarseRule && s.reasonKey === "at-rep-range-ceiling-with-target-rir") {
        const expected = predictedRepsAt(next, top, minReps, effort);
        if (expected < repMin - 0.5) {
          // The next load there is would drop the sets below the range (P18):
          // stretch the range here first — as far as it takes, or up to `cap`.
          const needed = repsNeededFor(next, top, repMin, effort);
          const aim = Math.min(needed, cap);
          if (minReps < aim) {
            return {
              kind: "hold",
              loadKg: top,
              targetReps: aim,
              headline: `Mantenha ${formatKg(top)} · busque ${aim} reps`,
              reason:
                needed <= cap
                  ? `O próximo peso, ${formatKg(next)}, é um salto de ${jumpText(top, next)}: com ${aim} reps aqui você chega a ${repMin}+ lá`
                  : `O próximo peso, ${formatKg(next)}, é um salto de ${jumpText(top, next)}: estenda a faixa até ${aim} reps antes de subir`,
            };
          }
          // Stretched as far as it goes: the jump is the only way up. Say how to back off.
          return {
            kind: "increase",
            loadKg: next,
            targetReps: repMin,
            headline: `↑ Suba para ${formatKg(next)}`,
            reason: `Salto grande (${jumpText(top, next)}): se as reps caírem abaixo de ${repMin}, volte para ${formatKg(top)}`,
          };
        }
      }
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
      // RIR-based holds don't move the load on reps — they move it when the
      // average RIR rises a full point above target. Say that, not "faça N reps
      // em todas" (which the user may already be doing) (A-055).
      const targetRir = s.reasonData?.targetRir ?? rirTarget;
      // A timed hold has no RIR to read: tell it in seconds (held to the top of the range),
      // which adviceInSeconds turns into "Suba a carga quando segurar N s em todas" (A-055).
      const unlock = unlockReps();
      const rirReason =
        s.reasonKey === "rir-at-target-keep-load" && targetRir != null && !input.timed
          ? `Suba a carga quando sobrar RIR ${rir(targetRir + 1)}+ em média (alvo ${rir(targetRir)})`
          : unlock !== null && unlock > repMax && next !== null
            ? `Suba para ${formatKg(next)} quando fizer ${unlock} reps em todas (salto de ${jumpText(top, next)})`
            : `Suba a carga quando fizer ${repMax} reps em todas`;
      return {
        kind: "hold",
        loadKg: top,
        targetReps: target,
        headline: `Mantenha ${formatKg(top)} · busque ${target} reps`,
        reason: rirReason,
      };
    }
    case "incomplete-sets": {
      // Most sets below the range with one load: that load is too heavy for the
      // range — one step back and reps first (P18), not "complete N reps" again.
      const below = input.sets.filter((x) => (x.reps ?? 0) < repMin).length;
      const oneLoad = loads.every((w) => Math.abs(w - top) < 1e-6);
      const down = coarseRule && oneLoad && below * 2 > input.sets.length ? nextLoadDown(grid, top) : null;
      if (down !== null) {
        const avgReps = input.sets.reduce((sum, x) => sum + (x.reps ?? 0), 0) / input.sets.length;
        const aim = Math.min(repMax, Math.max(repMin, Math.round(predictedRepsAt(down, top, avgReps, effort))));
        return {
          kind: "decrease",
          loadKg: down,
          targetReps: aim,
          headline: `↓ Volte para ${formatKg(down)} · busque ${aim} reps`,
          reason: `${below} de ${input.sets.length} séries abaixo de ${repMin} reps com ${formatKg(top)}: um degrau abaixo e mais reps antes de subir de novo`,
        };
      }
      return {
        kind: "hold",
        loadKg: top,
        targetReps: repMin,
        headline: `Mantenha ${formatKg(top)} · complete ${repMin} reps`,
        reason: `Alguma série ficou abaixo de ${repMin} reps`,
      };
    }
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
