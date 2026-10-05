import { parseDecimalInput } from "@/lib/training/set-plan";

/**
 * Validation for the "edit finished sets" form (A-083), lifted out of the
 * `"use client"` edit-sets-form.tsx so the node vitest harness can import the
 * pure logic without the component's client/next transitive imports.
 */

/** Which field of a kept, changed row is wrong: kg/reps ("value") or the RIR box. */
export type RowError = "value" | "rir";

/** Validates a kept row; null when it is fine. kg/reps are checked before RIR. */
export function validateEditRow(row: { weight: string; reps: string; rir: string }): RowError | null {
  const weightKg = parseDecimalInput(row.weight);
  const reps = parseDecimalInput(row.reps);
  if (weightKg === null || reps === null || reps < 1) return "value";
  if (row.rir.trim() !== "" && parseDecimalInput(row.rir) === null) return "rir";
  return null;
}
