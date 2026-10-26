/**
 * Small pure helpers of the workout screen's Minha academia parts (the
 * "Pesos" line, the swap sheet's gear notes). Client-safe: no catalog, no
 * gear map — only what the page already sent.
 */
import type { ExecutionExerciseLog } from "./types";

/**
 * Gear the gym lacks, as a sentence says it: "Hack"; "Remada baixa nem
 * Crossover / polia"; "Halteres, Barra W nem Smith" (pt-BR: "nem" joins what
 * is not there).
 */
export function lackedList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} nem ${names[names.length - 1]}`;
}

/**
 * An exercise whose load moves in kg: it gets the "Pesos" line and "Este
 * aparelho sobe de…". Not the body's own weight (its kg is extra load), not a
 * hold (its numbers are seconds), and not bands, cardio or rollers (never
 * progressed in kg — lib/training/load-grid's NONE).
 */
export function hasLoadSteps(ex: Pick<ExecutionExerciseLog, "bodyweight" | "timed" | "loadGrid">): boolean {
  return !ex.bodyweight && !ex.timed && ex.loadGrid.kind !== "NONE" && ex.loadGrid.kind !== "BODYWEIGHT";
}
