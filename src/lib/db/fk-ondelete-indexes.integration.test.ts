import "dotenv/config";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

/**
 * A-036 · Foreign-key columns that carry an ON DELETE action must have a
 * backing index, or the delete seq-scans the child table once per parent row
 * (the LGPD account-erasure path degraded to minutes for engaged users).
 *
 * Postgres never creates these indexes automatically. This locks in the nine
 * that migration 20261004190000 adds, named exactly as `@@index([col])` in
 * schema.prisma emits them, so a dropped or renamed index fails here.
 *
 * WorkoutSession.programId is NOT in this list: A-037's composite
 * WorkoutSession(programId, status) index (migration 20261004190100) leads with
 * programId and already backs that SET NULL cascade, so no standalone
 * single-column index exists for it.
 */

const EXPECTED: ReadonlyArray<{ index: string; table: string; column: string }> = [
  { index: "ProgramEnrollment_programId_idx", table: "ProgramEnrollment", column: "programId" },
  { index: "WorkoutSession_enrollmentId_idx", table: "WorkoutSession", column: "enrollmentId" },
  { index: "WorkoutSession_programDayId_idx", table: "WorkoutSession", column: "programDayId" },
  { index: "WorkoutExerciseLog_programExerciseId_idx", table: "WorkoutExerciseLog", column: "programExerciseId" },
  { index: "ExercisePersonalRecord_setLogId_idx", table: "ExercisePersonalRecord", column: "setLogId" },
  { index: "ExercisePersonalRecord_sessionId_idx", table: "ExercisePersonalRecord", column: "sessionId" },
  { index: "Notification_actorId_idx", table: "Notification", column: "actorId" },
  { index: "Notification_followRequestId_idx", table: "Notification", column: "followRequestId" },
  { index: "Notification_activityId_idx", table: "Notification", column: "activityId" },
];

describe("A-036 · ON DELETE foreign keys are indexed", () => {
  it("every listed FK column has its backing index in Postgres", async () => {
    const names = EXPECTED.map((e) => e.index);
    const rows = await prisma.$queryRaw<{ indexname: string; tablename: string; indexdef: string }[]>`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY(${names})
    `;
    const byName = new Map(rows.map((r) => [r.indexname, r]));

    for (const { index, table, column } of EXPECTED) {
      const row = byName.get(index);
      expect(row, `missing index ${index} (migration 20261004190000 not applied?)`).toBeDefined();
      expect(row!.tablename).toBe(table);
      // Single-column btree on exactly that FK column.
      expect(row!.indexdef).toContain(`("${column}")`);
    }
  });
});
