import { z } from "zod";
import {
  CABLE_STEP_OPTIONS,
  DUMBBELL_SCHEMES,
  EXERCISE_STEP_OPTIONS,
  KETTLEBELL_STEP_OPTIONS,
  PLATE_OPTIONS,
  STACK_STEP_OPTIONS,
  type GymLoadSettings,
} from "@/lib/training/load-grid";
import { GEAR_IDS } from "@/lib/exercises/gear";

/**
 * Settings → Minha academia (lib/actions/gym.ts). A plain module: a 'use
 * server' file may only export async functions. Every value must be one of
 * the options the form offers (lib/training/load-grid), so nothing but a
 * real rack or stack spacing reaches the profile.
 */
const oneOf = (options: readonly number[]) => z.number().refine((v) => options.some((o) => Math.abs(o - v) < 1e-9));

export const gymLoadsSchema = z
  .object({
    dumbbellScheme: z.enum(DUMBBELL_SCHEMES),
    stackStepKg: oneOf(STACK_STEP_OPTIONS),
    cableStepKg: oneOf(CABLE_STEP_OPTIONS),
    smallestPlateKg: oneOf(PLATE_OPTIONS),
    kettlebellStepKg: oneOf(KETTLEBELL_STEP_OPTIONS),
  })
  .strict();

/** Gear ids, at most every listed one; unknown ids are refused, duplicates collapse later (normalizeMissingGear). */
export const gearIdsSchema = z.array(z.enum(GEAR_IDS)).max(GEAR_IDS.length);

/** "Este aparelho sobe de…": one of the offered steps, or null = back to the gym's. */
export const exerciseStepSchema = oneOf(EXERCISE_STEP_OPTIONS).nullable();

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
/** Compile-time guard: the schema parses to exactly GymLoadSettings (lib/training/load-grid). */
export type GymLoadsInSync = Assert<Equal<z.infer<typeof gymLoadsSchema>, GymLoadSettings>>;
