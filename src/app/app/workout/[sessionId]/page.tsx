import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkoutSessionForExecution, getPreviousPerformance, getExerciseUserNote } from "@/lib/data/workout-session";
import { WorkoutExecutionClient } from "./workout-execution-client";
import type { ExecutionSession } from "./types";

export default async function WorkoutExecutionPage({ params, searchParams }: PageProps<"/app/workout/[sessionId]">) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const session = await getWorkoutSessionForExecution(sessionId);

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

  const executionSession: ExecutionSession = {
    id: session.id,
    name: session.name,
    startedAtIso: session.startedAt.toISOString(),
    notes: session.notes,
    exercises,
    notice: sp.aviso === "em-andamento" ? "em-andamento" : null,
  };

  return <WorkoutExecutionClient session={executionSession} />;
}
