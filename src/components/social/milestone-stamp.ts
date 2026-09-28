import { plural } from "@/lib/utils/format";

/**
 * A private milestone Activity ("carimbo": lib/programming/milestones.ts) read
 * back from its stored summary — the 10th/25th/50th/100th workout or a
 * completed block. The feed, a profile and the activity page draw it as a
 * stamp, never as a workout card: nothing to give an FG to, nothing to report.
 * Null for a workout's summary (or anything malformed).
 */
export type MilestoneStamp =
  | {
      kind: "WORKOUT_COUNT";
      /** The workout number: "Dossiê nº 10". */
      count: number;
      /** The workout that reached it. */
      sessionId: string | null;
      /** That workout's name ("Sexta — Inferior B"), when stored. */
      workoutName: string | null;
    }
  | {
      kind: "BLOCK_COMPLETED";
      programName: string;
      enrollmentId: string | null;
      templateSlug: string | null;
      weeks: number | null;
      sessionsDone: number | null;
      plannedSessions: number | null;
    };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);

export function milestoneStampOf(summary: unknown): MilestoneStamp | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  if (s.kind === "WORKOUT_COUNT") {
    const count = num(s.count);
    if (count == null || count < 1) return null;
    // Stored as "Dossiê nº 10 · Sexta — Inferior B": the workout's own name follows the dot.
    const name = str(s.workoutName);
    const prefix = `Dossiê nº ${count} · `;
    return {
      kind: "WORKOUT_COUNT",
      count,
      sessionId: str(s.sessionId),
      workoutName: name?.startsWith(prefix) ? str(name.slice(prefix.length)) : null,
    };
  }
  if (s.kind === "BLOCK_COMPLETED") {
    const name = str(s.programName) ?? str(s.workoutName)?.replace(/^Bloco concluído · /, "") ?? null;
    if (!name) return null;
    return {
      kind: "BLOCK_COMPLETED",
      programName: name,
      enrollmentId: str(s.enrollmentId),
      templateSlug: str(s.templateSlug),
      weeks: num(s.weeks),
      sessionsDone: num(s.sessionsDone),
      plannedSessions: num(s.plannedSessions),
    };
  }
  return null;
}

/** The stamp's own words: "Dossiê nº 10", "GD 1 concluído". */
export function stampText(stamp: MilestoneStamp): string {
  return stamp.kind === "WORKOUT_COUNT" ? `Dossiê nº ${stamp.count}` : `${stamp.programName} concluído`;
}

/** How a block went, in one line: "4 semanas · 18 de 20 treinos" (whatever was stored). */
export function blockStampLine(stamp: Extract<MilestoneStamp, { kind: "BLOCK_COMPLETED" }>): string | null {
  const parts: string[] = [];
  if (stamp.weeks != null && stamp.weeks > 0) parts.push(plural(stamp.weeks, "semana", "semanas"));
  if (stamp.sessionsDone != null) {
    parts.push(
      stamp.plannedSessions != null && stamp.plannedSessions > 0
        ? `${stamp.sessionsDone} de ${plural(stamp.plannedSessions, "treino", "treinos")}`
        : plural(stamp.sessionsDone, "treino", "treinos"),
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
