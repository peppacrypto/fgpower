import "server-only";
import { prisma } from "@/lib/db";
import { blockedNamesText, blockedPlanExercises } from "./gym-gear";

/** The active plan's exercises the gym can't do, as Aparelhos' notice says them. */
export interface BlockedPlan {
  /** Where "Ajustar à minha academia" goes: the plan's stand-in proposals. */
  href: string;
  count: number;
  /** "Agachamento Hack e Leg Press" (the first few, then "e mais N"). */
  names: string;
}

/**
 * What Settings → Minha academia → Aparelhos says about the active plan: the
 * exercises it prescribes that the gym's missing gear leaves undoable, or
 * null when there are none. The plan is read only when the gym lacks
 * something, and scoped to its owner as well — the id comes from the user's
 * own enrollment, and the query says so.
 */
export async function blockedPlan(userId: string, programId: string | null, missing: readonly string[]): Promise<BlockedPlan | null> {
  if (!programId || missing.length === 0) return null;
  const rows = await prisma.userProgramExercise.findMany({
    where: { day: { programId, program: { userId } } },
    // Day by day, in the plan's order: the names read the way the week does.
    orderBy: [{ day: { dayIndex: "asc" } }, { sortOrder: "asc" }],
    select: { exercise: { select: { id: true, slug: true, namePt: true, equipmentId: true, category: true } } },
  });
  const blocked = blockedPlanExercises(rows.map((r) => r.exercise), missing);
  if (blocked.length === 0) return null;
  return {
    href: `/app/programs/${programId}/academia`,
    count: blocked.length,
    names: blockedNamesText(blocked.map((ex) => ex.namePt)),
  };
}
