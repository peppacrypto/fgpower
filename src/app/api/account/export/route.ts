import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";

/** Exports the current user's own data as JSON (spec §43.15 — training history belongs to the user). */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [profile, programs, sessions, setLogs, personalRecords, bodyMetrics, favorites, notes] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userProgram.findMany({ where: { userId }, include: { days: { include: { exercises: true } } } }),
    prisma.workoutSession.findMany({ where: { userId }, include: { exerciseLogs: true } }),
    prisma.setLog.findMany({ where: { userId } }),
    prisma.exercisePersonalRecord.findMany({ where: { userId } }),
    prisma.bodyMetric.findMany({ where: { userId } }),
    prisma.favoriteExercise.findMany({ where: { userId } }),
    prisma.exerciseUserNote.findMany({ where: { userId } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    profile,
    programs,
    workoutSessions: sessions,
    setLogs,
    personalRecords,
    bodyMetrics,
    favoriteExercises: favorites,
    exerciseNotes: notes,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fgpower-export-${userId}.json"`,
    },
  });
}
