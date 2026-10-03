import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSession, requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";
import {
  getExerciseNotesForSession,
  getPreviousPerformances,
  getRecordBars,
  getWorkoutSessionForExecution,
  getWorkoutUserContext,
  getWorkoutWeek,
  rirExerciseOf,
} from "@/lib/data/workout-session";
import { weekRirTarget } from "@/lib/training/week-guidance";
import { recordBars } from "./pr-moment";
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
  isBodyweightExercise,
  isTimedHold,
  progressionPrincipleSlug,
} from "@/lib/training/set-plan";
import { WORKOUT_PREFS_COOKIE, devicePrefsFrom, parseWorkoutPrefsCookie } from "@/components/workout/local-workout";
import { deriveGroups } from "@/lib/programming/groups";
import { WorkoutExecutionClient } from "./workout-execution-client";
import type { ExecutionGroup, ExecutionSession } from "./types";

export async function generateMetadata({ params }: PageProps<"/app/workout/[sessionId]">): Promise<Metadata> {
  const { sessionId } = await params;
  const session = await getCurrentSession();
  const workout = session
    ? await prisma.workoutSession.findUnique({ where: { id: sessionId }, select: { name: true, userId: true } })
    : null;
  // "Treino · Segunda — Superior" in the tab and the app switcher (W-172).
  return workout && workout.userId === session?.user.id ? { title: `Treino · ${workout.name}` } : { title: NOT_FOUND_TITLE };
}

type ExecutionLogRow = { id: string; exerciseId: string; sortOrder: number; groupKey: string | null; substitutedFromExerciseId: string | null; restSeconds: number };

/**
 * Logs replaced mid-workout by a stand-in added after them ("Adicionar como
 * novo exercício": the stand-in records the exercise the program asked for).
 */
function replacedLogIds(logs: readonly ExecutionLogRow[]): Set<string> {
  const out = new Set<string>();
  for (const log of logs) {
    const asked = log.substitutedFromExerciseId ?? log.exerciseId;
    if (logs.some((o) => o.sortOrder > log.sortOrder && o.substitutedFromExerciseId === asked)) out.add(log.id);
  }
  return out;
}

/**
 * Each log's superset / circuit (W-104), lettered over the logs still in
 * play: a replaced log leaves its group to its stand-in (which kept the
 * group's key), so the pair stays "A1 / A2" instead of a three-way circuit.
 */
function workoutGroups(logs: readonly ExecutionLogRow[], replaced: Set<string>): (ExecutionGroup | null)[] {
  const live = logs.map((log, index) => ({ log, index })).filter(({ log }) => !replaced.has(log.id));
  const slots = deriveGroups(live.map(({ log }) => log));
  const out: (ExecutionGroup | null)[] = logs.map(() => null);
  live.forEach(({ index }, i) => {
    const slot = slots[i];
    if (!slot) return;
    const memberIndexes = live.slice(slot.firstIndex, slot.lastIndex + 1).map((m) => m.index);
    out[index] = {
      key: slot.key,
      label: slot.label,
      heading: slot.heading,
      kind: slot.kind,
      position: slot.position,
      size: slot.size,
      memberIndexes,
      transitionSeconds: logs[index].restSeconds,
      roundRestSeconds: logs[memberIndexes[memberIndexes.length - 1]].restSeconds,
    };
  });
  return out;
}

/** Onboarding limitations are echoed on the user's first workouts only. */
const ECHO_LIMITATIONS_FOR = 3;

/**
 * Reads everything in parallel — none of it waits on the session tree — noting
 * the server time just before the read (ExecutionSession.loadedAtMs).
 */
async function load(sessionId: string, userId: string) {
  const loadedAtMs = Date.now();
  const [session, previous, notes, context, week, bars] = await Promise.all([
    getWorkoutSessionForExecution(sessionId),
    getPreviousPerformances(userId, sessionId),
    getExerciseNotesForSession(userId, sessionId),
    getWorkoutUserContext(userId, ECHO_LIMITATIONS_FOR),
    getWorkoutWeek(userId, sessionId),
    getRecordBars(userId, sessionId),
  ]);
  return { loadedAtMs, session, previous, notes, week, bars, ...context };
}

export default async function WorkoutExecutionPage({ params, searchParams }: PageProps<"/app/workout/[sessionId]">) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const { loadedAtMs, session, previous, notes, week, bars, profile, finishedWorkouts } = await load(sessionId, user.id);

  if (!session) notFound();
  if (session.userId !== user.id) notFound();
  if (session.status === "COMPLETED") redirect(`/app/workout/${sessionId}/summary`);
  if (session.status === "DISCARDED") redirect("/app/today");

  const now = new Date(loadedAtMs);
  const replaced = replacedLogIds(session.exerciseLogs);
  const groups = workoutGroups(session.exerciseLogs, replaced);
  const exercises = session.exerciseLogs.map((log, index) => {
    const last = previous.get(log.exerciseId) ?? null;
    // The program exercise's own rule, then the program's, then double progression.
    const strategy = log.programExercise?.progressionStrategy ?? session.program?.progressionStrategy ?? "DOUBLE";
    const loadIncrementKg = log.programExercise?.loadIncrementKg ?? profile?.loadIncrementKg ?? 2.5;
    const timed = isTimedHold({ slug: log.exercise.slug, notes: log.notes });
    // The program's week moves the exercise's own target by its wave, never
    // below the exercise's floor (week-guidance weekRirTarget — the summary's
    // "Na próxima" reads the same, getSessionRirTargets).
    const rirTarget = weekRirTarget(log.rirTarget, week?.guidance ?? null, {
      baseline: week?.baselineRir ?? null,
      exercise: rirExerciseOf(log),
    });
    const advice = adviceFromLastTime({
      strategy,
      prescribed: { repMin: log.repMin, repMax: log.repMax, rirTarget },
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
      rirTarget,
      restSeconds: log.restSeconds,
      wasSkipped: log.wasSkipped,
      substitutedFromName: log.substitutedFrom?.namePt ?? null,
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
      bodyweight: isBodyweightExercise(log.exercise),
      timed,
      recordBars: recordBars(bars.get(log.exerciseId) ?? []),
      group: groups[index],
      replaced: replaced.has(log.id),
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
    haptics: profile?.hapticsEnabled ?? true,
    firstWorkout: finishedWorkouts === 0,
    limitations: finishedWorkouts < ECHO_LIMITATIONS_FOR ? limitations : null,
    stale,
    week: week
      ? {
          label: week.view.kind === "entry" ? "Sem. de entrada" : `Sem. ${week.view.week}`,
          title:
            week.view.kind === "entry"
              ? "Semana de entrada"
              : week.durationWeeks
                ? `Semana ${Math.min(week.view.week, week.durationWeeks)} de ${week.durationWeeks}`
                : `Semana ${week.view.week}`,
          rirTarget: week.guidance.rirTarget,
          notePt: week.guidance.notePt,
          setsNotePt: week.guidance.setsNotePt,
          deload: week.guidance.deload,
          test: week.guidance.test,
        }
      : null,
  };

  // This device's workout-screen prefs (folded hint, open warm-ups, a closed
  // note), so the first render already matches what the screen will show.
  const prefs = parseWorkoutPrefsCookie((await cookies()).get(WORKOUT_PREFS_COOKIE)?.value);
  const devicePrefs = devicePrefsFrom((name) => prefs[name], session.id);

  return (
    <WorkoutExecutionClient
      session={executionSession}
      devicePrefs={devicePrefs}
      // The exercise that was on screen (W-025: back from the technique page, a reload).
      initialExerciseLogId={typeof sp.ex === "string" ? sp.ex : null}
    />
  );
}
