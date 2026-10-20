/**
 * One-off: judges again the records of workouts scored before a first log
 * became a baseline (e67fc89). That scorer called a lift's first sets records
 * and also stored SESSION_VOLUME, which no scorer since writes — so its
 * workouts are the ones holding a SESSION_VOLUME row. Each is judged again on
 * the app's own path, as a corrected workout is: rescoreRecords (the records,
 * then the shared card that lists them) and afterRescore (the records
 * notification). Later workouts keep theirs: they were measured against
 * earlier sets, never against earlier records.
 *
 * Dry run by default; --apply writes. Runs against DATABASE_URL:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/rescore-legacy-records.ts [--apply]
 */
import { prisma } from "@/lib/db";
import { afterRescore } from "@/lib/workouts/finish-hooks";
import { rescoreRecords } from "@/lib/workouts/rescore";

const apply = process.argv.includes("--apply");

async function recordsByKind(sessionId: string) {
  const rows = await prisma.exercisePersonalRecord.groupBy({ by: ["kind"], where: { sessionId }, _count: true });
  return Object.fromEntries(rows.map((r) => [r.kind, r._count]));
}

async function main() {
  const legacy = await prisma.workoutSession.findMany({
    where: { status: "COMPLETED", records: { some: { kind: "SESSION_VOLUME" } } },
    orderBy: { finishedAt: "asc" },
    select: { id: true, userId: true, name: true, finishedAt: true },
  });
  console.log(`${legacy.length} workout(s) with records from the old scorer${apply ? "" : " (dry run: --apply to fix)"}`);
  for (const s of legacy) {
    console.log(`  ${s.id} ${s.finishedAt?.toISOString()} ${s.name}`, await recordsByKind(s.id));
  }
  if (!apply || legacy.length === 0) return;

  const byUser = new Map<string, string[]>();
  for (const s of legacy) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s.id]);
  for (const [userId, ids] of byUser) {
    await rescoreRecords(userId, ids);
    await afterRescore(userId, ids);
  }

  console.log("after:");
  let left = 0;
  for (const s of legacy) {
    const kinds = await recordsByKind(s.id);
    left += kinds.SESSION_VOLUME ?? 0;
    console.log(`  ${s.id}`, kinds);
  }
  // rescoreRecords logs a failed workout and goes on (a correction must still save): say so here.
  if (left > 0) {
    console.error(`${left} SESSION_VOLUME row(s) left: a rescore failed (see the errors above)`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
