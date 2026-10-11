import type { Prisma } from "@/generated/prisma/client";
import type { TrainingGoal } from "@/generated/prisma/enums";

/**
 * Parallel program tracks. A user runs AT MOST ONE active program per track at
 * a time (the partial unique index ProgramEnrollment_userId_track_active_key),
 * so a complementary plan can run alongside the primary one without ending it:
 *
 * - "primary": the scheduled strength/fitness plan (the GD series, flagships,
 *   custom programs). It owns the user's week — it is the one `getActiveEnrollment`
 *   returns and the only track `applyWeekLayout` lays onto weekdays.
 * - "mobility" / "yoga" / "skills": complementary, ON-DEMAND tracks. They never
 *   claim weekdays and never archive the primary plan. "skills" is calisthenics
 *   skill work (pull-up / handstand / planche progressions) done alongside a
 *   main plan; full bodyweight-strength calisthenics programs stay "primary".
 *
 * The track is denormalized onto ProgramEnrollment.track at activation so the
 * DB can scope the "one active" rule; `trackOf` is the single source of truth
 * that maps a program's goal to its track.
 */
export type ProgramTrack = "primary" | "mobility" | "yoga" | "skills";

export const PRIMARY_TRACK: ProgramTrack = "primary";

/** The track a program belongs to, from its training goal (null goal = primary). */
export function trackOf(goal: TrainingGoal | null | undefined): ProgramTrack {
  if (goal === "MOBILITY") return "mobility";
  if (goal === "YOGA") return "yoga";
  if (goal === "CALISTHENICS_SKILL") return "skills";
  return "primary";
}

/** True for the complementary, on-demand tracks (never own the week). */
export function isComplementaryTrack(track: ProgramTrack): boolean {
  return track !== "primary";
}

/**
 * A Prisma UserProgram `where` fragment selecting exactly the programs whose
 * goal maps to `track` — used to scope UserProgram writes/reads to one track
 * (UserProgram has no `track` column; its goal is the source). Primary =
 * everything that is NOT a complementary goal, INCLUDING a NULL goal (SQL
 * `NOT IN` would drop NULL rows, so the primary case spells out the OR).
 */
export function goalFilterForTrack(track: ProgramTrack): Prisma.UserProgramWhereInput {
  if (track === "mobility") return { goal: "MOBILITY" };
  if (track === "yoga") return { goal: "YOGA" };
  if (track === "skills") return { goal: "CALISTHENICS_SKILL" };
  return { OR: [{ goal: null }, { goal: { notIn: ["MOBILITY", "YOGA", "CALISTHENICS_SKILL"] as TrainingGoal[] } }] };
}
