import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { countedWeeks } from "@/lib/programming/block-progress";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { isAppliedDeload } from "@/lib/training/deload";
import {
  detectFatigue,
  fatigueLevel,
  keyExercises,
  type AnchorSession,
  type FatigueLevel,
  type FatigueTrigger,
} from "@/lib/training/fatigue";
import { getWeekGuidance, type ProgramWeekView, type WeekGuidanceView } from "@/lib/training/week-guidance";
import { startOfWeek } from "@/lib/training/week";
import { COUNTED_SET, SESSION_PERF_COLUMNS, toSessionPerf, type SessionPerfRow } from "./history";
import type { ActiveEnrollment } from "./dashboard";

/**
 * The fatigue signal's loader (W-128): the active block's key exercises'
 * last sessions and the last 7 days' check-ins, judged by the program's
 * own deload rule (lib/training/fatigue). Only the active enrollment's
 * workouts are compared — never across blocks — and never a deload or test
 * week's (planned or applied): lighter on purpose, they'd read as a drop.
 */

const DAY_MS = 86_400_000;
/** How far back a key exercise's sessions are read. */
const ANCHOR_LOOKBACK_DAYS = 42;
/** Rows kept per key exercise before the deload/test weeks are dropped (3 are compared). */
const ANCHOR_ROWS = 8;
/** Days of check-ins a trigger reads ("na mesma semana"). */
const CHECK_IN_DAYS = 7;
/** An applied deload opens no new one for this long (4 weeks, the one being applied aside). */
export const DELOAD_COOLDOWN_DAYS = 28;

export type FatigueSignal =
  | {
      level: "applied";
      enrollmentId: string;
      weekKey: string;
      /** The program week it was applied to (null in an entry week). */
      week: number | null;
      /** A workout was started under it this week: it stays (no "Desfazer"). */
      started: boolean;
    }
  | {
      level: FatigueLevel;
      enrollmentId: string;
      weekKey: string;
      week: number | null;
      triggers: FatigueTrigger[];
      /** How the key exercises were found: the program's anchors, or each day's first exercise. */
      keySource: "anchors" | "first";
    };

/** "Agora não" / "Entendi" on a week's signal: a UserDismissal key (one per enrollment and week). */
export function fatigueDismissalKey(enrollmentId: string, weekKey: string) {
  return `fatigue:${enrollmentId}:${weekKey}`;
}

/** Whether an applied deload sits in the cooldown before `monday` (another one can't be applied yet). */
export function inDeloadCooldown(deloadMondays: readonly number[], monday: number): boolean {
  return deloadMondays.some((m) => m < monday && m > monday - DELOAD_COOLDOWN_DAYS);
}

/** Whether a deload workout was started (not discarded) in this enrollment this week. */
async function deloadStartedThisWeek(userId: string, enrollmentId: string, now: Date) {
  const n = await prisma.workoutSession.count({
    where: {
      userId,
      enrollmentId,
      isDeload: true,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
      startedAt: { gte: startOfWeek(now) },
    },
  });
  return n > 0;
}

/**
 * This week's signal for the active enrollment, or null — not applicable
 * (the entry week, weeks 1–2, a planned deload or test week, right after a
 * deload week) or nothing to say. `lastWeekDeload` is the streak's last
 * week (planned or applied); `entryWeekTrained`, whether the block's
 * Thursday–Sunday entry week had a workout (it took week 1 of the counter).
 */
export async function getFatigueSignal(
  userId: string,
  enrollment: ActiveEnrollment,
  ctx: {
    now: Date;
    weekView: ProgramWeekView;
    guidance: WeekGuidanceView | null;
    lastWeekDeload: boolean;
    entryWeekTrained: boolean;
  },
): Promise<FatigueSignal | null> {
  const { now, weekView } = ctx;
  const monday = mondayOf(dayNumberOf(now));
  const weekKey = String(monday);
  const week = weekView.kind === "week" ? weekView.week : null;
  const base = { enrollmentId: enrollment.id, weekKey, week };

  if (isAppliedDeload(enrollment.deloadMondays, monday)) {
    return { level: "applied", ...base, started: await deloadStartedThisWeek(userId, enrollment.id, now) };
  }
  if (weekView.kind === "entry" || weekView.week < 3) return null;
  if (ctx.guidance?.deload || ctx.guidance?.test || ctx.lastWeekDeload) return null;
  if (inDeloadCooldown(enrollment.deloadMondays, monday)) return null;

  const program = enrollment.program;
  const guidanceOf = (programWeek: number | null) =>
    programWeek == null
      ? null
      : getWeekGuidance(program.weeklyGuidance, countedWeeks(programWeek, enrollment.startedAt, ctx.entryWeekTrained), {
          templateSlug: program.sourceTemplate?.slug ?? null,
          durationWeeks: program.durationWeeks,
        });
  /** A session of a deload or test week (lighter on purpose): never compared. */
  const lightWeek = (programWeek: number | null) => {
    const g = guidanceOf(programWeek);
    return g?.deload === true || g?.test === true;
  };

  const keys = keyExercises(
    program.days.map((d) => ({
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        slug: e.exercise.slug,
        notes: e.notes,
        sortOrder: e.sortOrder,
        category: e.exercise.category,
      })),
    })),
  );
  const since = new Date(now.getTime() - ANCHOR_LOOKBACK_DAYS * DAY_MS);
  const [anchorRows, checkIns] = await Promise.all([
    keys.exerciseIds.length === 0
      ? []
      : prisma.$queryRaw<(SessionPerfRow & { exerciseId: string; programWeek: number | null })[]>`
          WITH per_session AS (
            SELECT l."exerciseId", s.id AS "sessionId", s."finishedAt" AS date, s."programWeek", ${SESSION_PERF_COLUMNS}
            FROM "WorkoutExerciseLog" l
            JOIN "WorkoutSession" s ON s.id = l."sessionId"
            JOIN "SetLog" x ON x."exerciseLogId" = l.id AND x."userId" = ${userId}
            WHERE l."userId" = ${userId}
              AND s."userId" = ${userId}
              AND s."enrollmentId" = ${enrollment.id}
              AND s.status = 'COMPLETED'
              AND NOT s."isDeload"
              AND s."finishedAt" >= ${since} AND s."finishedAt" <= ${now}
              AND l."exerciseId" IN (${Prisma.join(keys.exerciseIds)})
              AND ${COUNTED_SET}
            GROUP BY l."exerciseId", s.id, s."finishedAt", s."programWeek"
          ), ranked AS (
            SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p."exerciseId" ORDER BY p.date DESC, p."sessionId" DESC) AS rn
            FROM per_session p
          )
          SELECT * FROM ranked WHERE rn <= ${ANCHOR_ROWS} ORDER BY "exerciseId", date ASC, "sessionId" ASC`,
    prisma.workoutSession.findMany({
      where: {
        userId,
        enrollmentId: enrollment.id,
        status: "COMPLETED",
        isDeload: false,
        checkInAt: { not: null },
        finishedAt: { gte: new Date(now.getTime() - CHECK_IN_DAYS * DAY_MS), lte: now },
      },
      select: { soreness: true, shortSleep: true, lingeringPain: true, highStress: true, programWeek: true },
    }),
  ]);

  const names = new Map(program.days.flatMap((d) => d.exercises.map((e) => [e.exerciseId, e.exercise.namePt] as const)));
  const anchors = keys.exerciseIds.map((exerciseId) => ({
    name: names.get(exerciseId) ?? "Exercício",
    sessions: anchorRows
      .filter((r) => r.exerciseId === exerciseId && !lightWeek(r.programWeek))
      .map((r): AnchorSession => {
        const perf = toSessionPerf(r);
        return { date: perf.date, topKg: perf.topKg, topReps: perf.topReps, e1rmKg: perf.e1rmKg };
      }),
  }));
  const triggers = detectFatigue({
    anchors,
    checkIns: checkIns.filter((c) => !lightWeek(c.programWeek)),
    daysPerWeek: program.daysPerWeek,
    now,
  });
  // Next program week: the program's own deload or test week coming anyway.
  const next = getWeekGuidance(program.weeklyGuidance, weekView.guidanceWeek + 1, {
    templateSlug: program.sourceTemplate?.slug ?? null,
    durationWeeks: program.durationWeeks,
  });
  const level = fatigueLevel(triggers, next?.deload === true || next?.test === true);
  return level ? { level, ...base, triggers, keySource: keys.source } : null;
}
