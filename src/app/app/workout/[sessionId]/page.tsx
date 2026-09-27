import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSession, requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";
import {
  getExerciseNotesForSession,
  getPreviousPerformances,
  getWorkoutSessionForExecution,
  getWorkoutUserContext,
} from "@/lib/data/workout-session";
import {
  assessOpenSession,
  formatSpDate,
  formatSpDaysAgo,
  formatSpTime,
  formatSpWeekdayDate,
  spDayKey,
} from "@/lib/training/stale";
import {
  adviceFromLastTime,
  isBodyweightEquipment,
  isTimedHold,
  progressionPrincipleSlug,
} from "@/lib/training/set-plan";
import { WORKOUT_PREFS_COOKIE, devicePrefsFrom, parseWorkoutPrefsCookie } from "@/components/workout/local-workout";
import { WorkoutExecutionClient } from "./workout-execution-client";
import type { ExecutionSession } from "./types";

export async function generateMetadata({ params }: PageProps<"/app/workout/[sessionId]">): Promise<Metadata> {
  const { sessionId } = await params;
  const session = await getCurrentSession();
  const workout = session
    ? await prisma.workoutSession.findUnique({ where: { id: sessionId }, select: { name: true, userId: true } })
    : null;
  return workout && workout.userId === session?.user.id ? { title: workout.name } : { title: NOT_FOUND_TITLE };
}

/** Onboarding limitations are echoed on the user's first workouts only. */
const ECHO_LIMITATIONS_FOR = 3;

/**
 * Reads everything in parallel — none of it waits on the session tree — noting
 * the server time just before the read (ExecutionSession.loadedAtMs).
 */
async function load(sessionId: string, userId: string) {
  const loadedAtMs = Date.now();
  const [session, previous, notes, context] = await Promise.all([
    getWorkoutSessionForExecution(sessionId),
    getPreviousPerformances(userId, sessionId),
    getExerciseNotesForSession(userId, sessionId),
    getWorkoutUserContext(userId, ECHO_LIMITATIONS_FOR),
  ]);
  return { loadedAtMs, session, previous, notes, ...context };
}

export default async function WorkoutExecutionPage({ params, searchParams }: PageProps<"/app/workout/[sessionId]">) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const { loadedAtMs, session, previous, notes, profile, finishedWorkouts } = await load(sessionId, user.id);

  if (!session) notFound();
  if (session.userId !== user.id) notFound();
  if (session.status === "COMPLETED") redirect(`/app/workout/${sessionId}/summary`);
  if (session.status === "DISCARDED") redirect("/app/today");

  const now = new Date(loadedAtMs);
  const exercises = session.exerciseLogs.map((log) => {
    const last = previous.get(log.exerciseId) ?? null;
    // The program exercise's own rule, then the program's, then double progression.
    const strategy = log.programExercise?.progressionStrategy ?? session.program?.progressionStrategy ?? "DOUBLE";
    const loadIncrementKg = log.programExercise?.loadIncrementKg ?? profile?.loadIncrementKg ?? 2.5;
    const timed = isTimedHold({ slug: log.exercise.slug, notes: log.notes });
    const advice = adviceFromLastTime({
      strategy,
      prescribed: { repMin: log.repMin, repMax: log.repMax, rirTarget: log.rirTarget },
      lastTime: last,
      loadIncrementKg,
      timed,
    });
    const why = progressionPrincipleSlug(strategy);
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
      persistentNote: notes.get(log.exerciseId) ?? null,
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
      previousSets: last?.sets ?? [],
      lastTime: last ? { date: formatSpDate(last.doneAt), ago: formatSpDaysAgo(last.doneAt, now) } : null,
      advice: advice ? { ...advice, whyHref: why ? `/app/science/${why}` : null } : null,
      strategy,
      loadIncrementKg,
      bodyweight: isBodyweightEquipment(log.exercise.equipment?.category),
      timed,
    };
  });

  // Same rules as Today's "Treino de … não finalizado" and the stale finish (lib/training/stale.ts).
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

  const limitations = profile?.limitations?.trim() || null;
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
    firstWorkout: finishedWorkouts === 0,
    limitations: finishedWorkouts < ECHO_LIMITATIONS_FOR ? limitations : null,
    stale,
  };

  // This device's workout-screen prefs (folded hint, open warm-ups, a closed
  // note), so the first render already matches what the screen will show.
  const prefs = parseWorkoutPrefsCookie((await cookies()).get(WORKOUT_PREFS_COOKIE)?.value);
  const devicePrefs = devicePrefsFrom((name) => prefs[name], session.id);

  return <WorkoutExecutionClient session={executionSession} devicePrefs={devicePrefs} />;
}
