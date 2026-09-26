import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import { getWorkoutSessionForExecution, getPreviousPerformance, getExerciseUserNote } from "@/lib/data/workout-session";
import { assessOpenSession, formatSpDate, formatSpTime, formatSpWeekdayDate, spDayKey } from "@/lib/training/stale";
import { WorkoutExecutionClient } from "./workout-execution-client";
import type { ExecutionSession } from "./types";

/** Reads the session, noting the server time just before the read (ExecutionSession.loadedAtMs). */
async function load(sessionId: string, userId: string) {
  const loadedAtMs = Date.now();
  const [session, profile] = await Promise.all([getWorkoutSessionForExecution(sessionId), getProfile(userId)]);
  return { loadedAtMs, session, profile };
}

export default async function WorkoutExecutionPage({ params, searchParams }: PageProps<"/app/workout/[sessionId]">) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const { loadedAtMs, session, profile } = await load(sessionId, user.id);

  if (!session) notFound();
  if (session.userId !== user.id) notFound();
  if (session.status === "COMPLETED") redirect(`/app/workout/${sessionId}/summary`);
  if (session.status === "DISCARDED") redirect("/app/today");

  const exercises = await Promise.all(
    session.exerciseLogs.map(async (log) => {
      const [previousSets, note] = await Promise.all([
        getPreviousPerformance(user.id, log.exerciseId, sessionId),
        getExerciseUserNote(user.id, log.exerciseId),
      ]);
      return {
        id: log.id,
        exerciseId: log.exerciseId,
        exerciseName: log.exercise.namePt,
        exerciseSlug: log.exercise.slug,
        imageUrl: log.exercise.media[0]?.url ?? null,
        sortOrder: log.sortOrder,
        prescribedSets: log.prescribedSets,
        warmupSets: log.warmupSets,
        repMin: log.repMin,
        repMax: log.repMax,
        rirTarget: log.rirTarget,
        restSeconds: log.restSeconds,
        wasSkipped: log.wasSkipped,
        notes: log.notes,
        persistentNote: note?.note ?? null,
        sets: log.sets.map((s) => ({
          id: s.id,
          setNumber: s.setNumber,
          setType: s.setType,
          isExtra: s.isExtra,
          weightKg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
          isCompleted: s.isCompleted,
          notes: s.notes,
        })),
        previousSets: previousSets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, rir: s.rir, isExtra: s.isExtra })),
      };
    }),
  );

  // Same rules as Today's "Treino de … não finalizado" and the stale finish (lib/training/stale.ts).
  const now = new Date(loadedAtMs);
  const open = assessOpenSession(
    session.startedAt,
    session.exerciseLogs.flatMap((log) => log.sets.map((s) => ({ ...s, wasSkipped: log.wasSkipped }))),
    now,
  );
  let stale: ExecutionSession["stale"] = null;
  if (open.showSince) {
    const today = spDayKey(now);
    const saveAs = open.saveAs.finishedAt;
    stale = {
      since: spDayKey(session.startedAt) === today ? formatSpTime(session.startedAt) : formatSpWeekdayDate(session.startedAt),
      saveAsDay: spDayKey(saveAs) === today ? null : formatSpDate(saveAs),
      leftOpen: open.leftOpen,
    };
  }

  const executionSession: ExecutionSession = {
    id: session.id,
    name: session.name,
    startedAtIso: session.startedAt.toISOString(),
    loadedAtMs,
    notes: session.notes,
    exercises,
    notice: sp.aviso === "em-andamento" ? "em-andamento" : null,
    programId: session.programId,
    restTimerSound: profile?.restTimerSound ?? true,
    stale,
  };

  return <WorkoutExecutionClient session={executionSession} />;
}
