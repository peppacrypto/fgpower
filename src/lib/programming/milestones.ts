/**
 * Milestones ("carimbos"), sparse on purpose (W-130/W-131): the 10th, 25th,
 * 50th and 100th workout, and a completed block. No badge wall, no tonnage
 * badges, nothing posted publicly — each one is a private Activity its owner
 * sees, and the workout summary shows the dossier number as a stamp.
 */
export const WORKOUT_MILESTONES = [10, 25, 50, 100] as const;

export function isWorkoutMilestone(ordinal: number): boolean {
  return (WORKOUT_MILESTONES as readonly number[]).includes(ordinal);
}

/**
 * What a milestone Activity stores in `summary`. It keeps the fields a
 * workout card reads (workoutName, totalWorkingSets, exercises, prs), so the
 * owner's feed and profile render it like any other card until they learn
 * to draw it as a stamp; `kind` tells them apart.
 */
export interface MilestoneActivitySummary {
  kind: "WORKOUT_COUNT" | "BLOCK_COMPLETED";
  workoutName: string;
  durationSeconds: null;
  totalWorkingSets: number;
  totalVolumeKg: null;
  exercises: [];
  prs: [];
  /** WORKOUT_COUNT: the workout number (10, 25, 50, 100) and the workout that reached it. */
  count?: number;
  sessionId?: string;
  /** BLOCK_COMPLETED: the block and how it went. */
  enrollmentId?: string;
  programName?: string;
  templateSlug?: string | null;
  weeks?: number;
  sessionsDone?: number;
  plannedSessions?: number | null;
}

export function workoutMilestoneSummary(p: {
  count: number;
  sessionId: string;
  sessionName: string;
  totalWorkingSets: number;
}): MilestoneActivitySummary {
  return {
    kind: "WORKOUT_COUNT",
    workoutName: `Dossiê nº ${p.count} · ${p.sessionName}`,
    durationSeconds: null,
    totalWorkingSets: p.totalWorkingSets,
    totalVolumeKg: null,
    exercises: [],
    prs: [],
    count: p.count,
    sessionId: p.sessionId,
  };
}

export function blockCompletedSummary(p: {
  enrollmentId: string;
  programName: string;
  templateSlug: string | null;
  weeks: number;
  sessionsDone: number;
  plannedSessions: number | null;
  totalWorkingSets: number;
}): MilestoneActivitySummary {
  return {
    kind: "BLOCK_COMPLETED",
    workoutName: `Bloco concluído · ${p.programName}`,
    durationSeconds: null,
    totalWorkingSets: p.totalWorkingSets,
    totalVolumeKg: null,
    exercises: [],
    prs: [],
    enrollmentId: p.enrollmentId,
    programName: p.programName,
    templateSlug: p.templateSlug,
    weeks: p.weeks,
    sessionsDone: p.sessionsDone,
    plannedSessions: p.plannedSessions,
  };
}
