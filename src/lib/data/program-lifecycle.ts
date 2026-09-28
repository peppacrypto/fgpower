import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { blockProgress, countedWeeks, entryWeekEnd, resumePoint, type BlockProgress } from "@/lib/programming/block-progress";
import { blockCompletedSummary, isWorkoutMilestone, workoutMilestoneSummary } from "@/lib/programming/milestones";
import { layOutWeek } from "@/lib/programming/schedule";
import { SHOWN_PR_KINDS } from "@/lib/training/personal-records-core";
import { createNotification, notificationKey } from "@/lib/social/notifications";
import { GD_SERIES, seriesPosition } from "@/lib/training/program-calendar";
import { startOfWeek } from "@/lib/training/week";

/**
 * A program block's life after activation: how far along it is, how it ends
 * (COMPLETED, with a private activity and a notification), what Today and the
 * summary offer next ("Começar GD 2" / "Repetir bloco"), where a stopped one
 * picks up, and the workout-count milestones. advanceProgram
 * (lib/actions/workouts.ts) closes a block as a workout is finished;
 * getRecentlyCompletedBlock also closes one whose last week is over by the
 * calendar, so Today says so on the Monday after it instead of offering
 * another week the block doesn't have.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** A finished workout that counts (the weekly counter's rule: at least one working set). */
const FINISHED = { status: "COMPLETED" as const, totalWorkingSets: { gt: 0 } };

/** How long after a block ends Today keeps offering what comes next. */
export const COMPLETED_BLOCK_WINDOW_MS = 14 * 86_400_000;

/**
 * Whether the enrollment has a finished workout in its Thursday–Sunday entry
 * week — only then did that week take a number of the week counter, and only
 * then is it left out of the block's weeks (block-progress.ts countedWeeks).
 * False for a program activated Monday–Wednesday (no entry week).
 */
export async function entryWeekWasTrained(
  db: Db,
  e: { id: string; userId: string; startedAt: Date },
): Promise<boolean> {
  const end = entryWeekEnd(e.startedAt);
  if (!end) return false;
  const inEntry = await db.workoutSession.findFirst({
    where: { userId: e.userId, enrollmentId: e.id, ...FINISHED, finishedAt: { lt: end } },
    select: { id: true },
  });
  return inEntry !== null;
}

// ---------------------------------------------------------------------------
// The week a program is trained on
// ---------------------------------------------------------------------------

/**
 * Lays the program's days out on the user's week (programming/schedule.ts:
 * weekday-named days keep their weekday; others go onto Profile.preferredDays,
 * or a spread; a plan that repeats its days gets none) and makes the
 * profile's weekly frequency the program's. Run whenever a program becomes
 * the active one, and when the active one's days or frequency change.
 */
export async function applyWeekLayout(db: Db, userId: string, programId: string) {
  const [program, profile] = await Promise.all([
    db.userProgram.findFirst({
      where: { id: programId, userId },
      select: { daysPerWeek: true, days: { orderBy: { dayIndex: "asc" }, select: { id: true, name: true, weekday: true } } },
    }),
    db.profile.findUnique({ where: { userId }, select: { preferredDays: true, daysPerWeek: true } }),
  ]);
  if (!program) return;
  const layout = layOutWeek(program.days, program.daysPerWeek, profile?.preferredDays ?? []);
  for (const [i, day] of program.days.entries()) {
    const weekday = layout.weekdays[i] ?? null;
    if (day.weekday !== weekday) await db.userProgramDay.update({ where: { id: day.id }, data: { weekday } });
  }
  const frequency = Math.max(1, Math.min(7, program.daysPerWeek));
  if (profile && profile.daysPerWeek !== frequency) {
    await db.profile.update({ where: { userId }, data: { daysPerWeek: frequency } });
  }
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface EnrollmentLike {
  id: string;
  currentWeek: number;
  startedAt: Date;
  program: { durationWeeks: number | null; daysPerWeek: number; dayCount: number };
}

/**
 * "Semana 3 de 13 · 18 de 65 treinos (92% aderência)" for one running
 * enrollment (see block-progress.ts): the entry week is read from the
 * calendar at `now`, as Today reads it.
 */
export async function getBlockProgress(
  db: Db,
  userId: string,
  e: EnrollmentLike,
  now: Date = new Date(),
): Promise<BlockProgress> {
  const sessions = await db.workoutSession.findMany({
    where: { userId, enrollmentId: e.id, ...FINISHED },
    select: { programWeek: true, programDayId: true, finishedAt: true },
  });
  return blockProgress({
    currentWeek: e.currentWeek,
    startedAt: e.startedAt,
    durationWeeks: e.program.durationWeeks,
    daysPerWeek: e.program.daysPerWeek,
    dayCount: e.program.dayCount,
    sessions,
    now,
  });
}

// ---------------------------------------------------------------------------
// Closing a block
// ---------------------------------------------------------------------------

/**
 * Ends an ACTIVE enrollment as COMPLETED — once: a second call (another tab,
 * a redo after the end, the calendar check) finds it no longer ACTIVE and
 * does nothing. The program moves to "Arquivados" (read there as
 * "Concluído"); a PRIVATE PROGRAM_COMPLETED activity and a (read)
 * notification record it. Nothing is posted publicly. Returns whether it
 * closed the block.
 */
export async function closeBlock(db: Db, p: { userId: string; enrollmentId: string; now: Date }): Promise<boolean> {
  const closed = await db.programEnrollment.updateMany({
    where: { id: p.enrollmentId, userId: p.userId, status: "ACTIVE" },
    data: { status: "COMPLETED", endedAt: p.now },
  });
  if (closed.count === 0) return false;

  const enrollment = await db.programEnrollment.findUniqueOrThrow({
    where: { id: p.enrollmentId },
    select: {
      id: true,
      currentWeek: true,
      startedAt: true,
      program: {
        select: {
          id: true,
          name: true,
          status: true,
          daysPerWeek: true,
          durationWeeks: true,
          sourceTemplate: { select: { slug: true } },
          _count: { select: { days: true } },
        },
      },
    },
  });
  const program = enrollment.program;
  if (program.status === "ACTIVE") {
    await db.userProgram.update({ where: { id: program.id }, data: { status: "ARCHIVED", archivedAt: p.now } });
  }
  const sessions = await db.workoutSession.findMany({
    where: { userId: p.userId, enrollmentId: enrollment.id, ...FINISHED },
    select: { programWeek: true, programDayId: true, finishedAt: true, totalWorkingSets: true },
  });
  const progress = blockProgress({
    currentWeek: enrollment.currentWeek,
    startedAt: enrollment.startedAt,
    durationWeeks: program.durationWeeks,
    daysPerWeek: program.daysPerWeek,
    dayCount: program._count.days,
    sessions,
  });
  const templateSlug = program.sourceTemplate?.slug ?? null;
  const activity = await db.activity.create({
    data: {
      userId: p.userId,
      type: "PROGRAM_COMPLETED",
      visibility: "PRIVATE",
      summary: blockCompletedSummary({
        enrollmentId: enrollment.id,
        programName: program.name,
        templateSlug,
        weeks: progress.week,
        sessionsDone: progress.sessionsDone,
        plannedSessions: progress.plannedSessions,
        totalWorkingSets: sessions.reduce((sum, s) => sum + (s.totalWorkingSets ?? 0), 0),
      }) as never,
    },
    select: { id: true },
  });
  // The user's own achievement: logged already read (never the unread pip), once
  // per block — a block reopened by deleting its last workout and closed again
  // gets a fresh row (the old one went with its activity).
  await createNotification(
    db,
    {
      recipientId: p.userId,
      actorId: null,
      type: "PROGRAM_COMPLETED",
      dedupeKey: notificationKey.block(enrollment.id),
      activityId: activity.id,
      data: { enrollmentId: enrollment.id, programName: program.name, templateSlug },
      read: true,
    },
    p.now,
  );
  return true;
}

/**
 * Closes the active block when its last week is over by the calendar: the
 * block's weeks (a trained entry week left out) are at the last one and the
 * last workout was done in an earlier calendar week (or it is already past
 * it). Called before Today reads what's active, so the Monday after a block
 * shows its end.
 */
export async function settleFinishedBlock(userId: string, now: Date = new Date()): Promise<boolean> {
  const e = await prisma.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true, currentWeek: true, startedAt: true, program: { select: { durationWeeks: true } } },
  });
  const weeks = e?.program.durationWeeks;
  if (!e || !weeks) return false;
  const counted = countedWeeks(
    e.currentWeek,
    e.startedAt,
    await entryWeekWasTrained(prisma, { id: e.id, userId, startedAt: e.startedAt }),
  );
  if (counted < weeks) return false;
  if (counted === weeks) {
    const last = await prisma.workoutSession.findFirst({
      where: { userId, enrollmentId: e.id, ...FINISHED },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    });
    if (!last?.finishedAt || last.finishedAt >= startOfWeek(now)) return false;
  }
  return prisma.$transaction((tx) => closeBlock(tx, { userId, enrollmentId: e.id, now }));
}

// ---------------------------------------------------------------------------
// A finished block, and what comes next
// ---------------------------------------------------------------------------

export interface CompletedBlock {
  enrollmentId: string;
  programId: string;
  programName: string;
  templateSlug: string | null;
  /** Workouts of the plan done (distinct days per week, entry week excluded): "19/20". */
  sessionsDone: number;
  plannedSessions: number | null;
  /** Every finished workout of the block — redos and the entry week's included: what stays in the history. */
  savedWorkouts: number;
  /** Program weeks done. */
  weeks: number;
  durationWeeks: number | null;
  /** Exercises that set a record during the block. */
  prCount: number;
  /** Estimated 1RM at the block's first and last week, for its most-trained lifts (up to 3). */
  anchorProgress?: { exerciseName: string; slug: string; fromKg: number; toKg: number }[];
  /** The block's place in the GD series; null outside it. */
  series: { index: number; total: number } | null;
  /** The series' next block; null for the last block and for programs outside the series. */
  next: { slug: string; name: string; index: number; total: number } | null;
  completedAt: Date;
}

/**
 * The block the user finished in the last 14 days, while nothing else is
 * active — what Today's "BLOCO CONCLUÍDO" hero shows, with "Começar <next>"
 * and "Repetir bloco". First closes a block whose last week is over (see
 * settleFinishedBlock): read it before the active enrollment, not alongside.
 */
export async function getRecentlyCompletedBlock(userId: string, now: Date = new Date()): Promise<CompletedBlock | null> {
  try {
    await settleFinishedBlock(userId, now);
  } catch (err) {
    console.error("settleFinishedBlock failed", userId, err);
  }
  const active = await prisma.programEnrollment.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } });
  if (active) return null;
  const e = await prisma.programEnrollment.findFirst({
    where: { userId, status: "COMPLETED", endedAt: { gte: new Date(now.getTime() - COMPLETED_BLOCK_WINDOW_MS) } },
    orderBy: { endedAt: "desc" },
    select: { id: true },
  });
  return e ? describeCompletedBlock(userId, e.id) : null;
}

/** A COMPLETED enrollment of the user, as CompletedBlock (null otherwise). */
export async function describeCompletedBlock(userId: string, enrollmentId: string): Promise<CompletedBlock | null> {
  const e = await prisma.programEnrollment.findFirst({
    where: { id: enrollmentId, userId, status: "COMPLETED" },
    select: {
      id: true,
      currentWeek: true,
      startedAt: true,
      endedAt: true,
      program: {
        select: {
          id: true,
          name: true,
          daysPerWeek: true,
          durationWeeks: true,
          sourceTemplate: { select: { slug: true } },
          _count: { select: { days: true } },
        },
      },
    },
  });
  if (!e) return null;
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, enrollmentId: e.id, ...FINISHED },
    select: { id: true, programWeek: true, programDayId: true, finishedAt: true },
  });
  const progress = blockProgress({
    currentWeek: e.currentWeek,
    startedAt: e.startedAt,
    durationWeeks: e.program.durationWeeks,
    daysPerWeek: e.program.daysPerWeek,
    dayCount: e.program._count.days,
    sessions,
  });
  const ids = sessions.map((s) => s.id);
  const [records, anchorProgress] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([])
      : prisma.exercisePersonalRecord.findMany({
          where: { userId, sessionId: { in: ids }, kind: { in: [...SHOWN_PR_KINDS] } },
          select: { exerciseId: true },
          distinct: ["exerciseId"],
        }),
    anchorLifts(userId, e.id),
  ]);

  const templateSlug = e.program.sourceTemplate?.slug ?? null;
  const pos = seriesPosition(templateSlug);
  const nextTemplate = pos?.nextSlug
    ? await prisma.workoutTemplate.findFirst({
        where: { slug: pos.nextSlug, isPublished: true },
        select: { slug: true, namePt: true },
      })
    : null;
  return {
    enrollmentId: e.id,
    programId: e.program.id,
    programName: e.program.name,
    templateSlug,
    sessionsDone: progress.sessionsDone,
    plannedSessions: progress.plannedSessions,
    savedWorkouts: sessions.length,
    weeks: progress.week,
    durationWeeks: e.program.durationWeeks,
    prCount: records.length,
    anchorProgress: anchorProgress.length > 0 ? anchorProgress : undefined,
    series: pos ? { index: pos.index, total: pos.total } : null,
    next:
      nextTemplate && pos
        ? { slug: nextTemplate.slug, name: nextTemplate.namePt, index: pos.index + 1, total: pos.total }
        : null,
    completedAt: e.endedAt ?? new Date(),
  };
}

/**
 * The block's most-trained loaded lifts (up to 3, done in at least two
 * program weeks): the best estimated 1RM (Epley, sets of 1–10 reps) in the
 * first and in the last week each was done.
 */
async function anchorLifts(userId: string, enrollmentId: string) {
  const rows = await prisma.$queryRaw<
    { exerciseId: string; name: string; slug: string; week: number; e1rm: number; sessions: bigint | number }[]
  >`
    SELECT l."exerciseId", e."namePt" AS name, e.slug, s."programWeek" AS week,
      MAX(CASE WHEN x.reps = 1 THEN x."weightKg" ELSE x."weightKg" * (1 + x.reps / 30.0) END) AS e1rm,
      COUNT(DISTINCT s.id) AS sessions
    FROM "WorkoutSession" s
    JOIN "WorkoutExerciseLog" l ON l."sessionId" = s.id
    JOIN "Exercise" e ON e.id = l."exerciseId"
    JOIN "SetLog" x ON x."exerciseLogId" = l.id
    WHERE s."userId" = ${userId} AND s."enrollmentId" = ${enrollmentId} AND s.status = 'COMPLETED'
      AND s."programWeek" IS NOT NULL
      AND x."isCompleted" AND x."setType" <> 'WARMUP' AND x."weightKg" > 0 AND x.reps BETWEEN 1 AND 10
    GROUP BY l."exerciseId", e."namePt", e.slug, s."programWeek"`;
  const byExercise = new Map<string, { name: string; slug: string; weeks: { week: number; e1rm: number }[]; sessions: number }>();
  for (const r of rows) {
    const entry = byExercise.get(r.exerciseId) ?? { name: r.name, slug: r.slug, weeks: [], sessions: 0 };
    entry.weeks.push({ week: Number(r.week), e1rm: Number(r.e1rm) });
    entry.sessions += Number(r.sessions);
    byExercise.set(r.exerciseId, entry);
  }
  const round = (n: number) => Math.round(n * 2) / 2;
  return [...byExercise.values()]
    .filter((x) => x.weeks.length >= 2)
    .map((x) => {
      const sorted = [...x.weeks].sort((a, b) => a.week - b.week);
      return {
        exerciseName: x.name,
        slug: x.slug,
        fromKg: round(sorted[0].e1rm),
        toKg: round(sorted[sorted.length - 1].e1rm),
        sessions: x.sessions,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.toKg - b.fromKg - (a.toKg - a.fromKg))
    .slice(0, 3)
    .map((x) => ({ exerciseName: x.exerciseName, slug: x.slug, fromKg: x.fromKg, toKg: x.toKg }));
}

// ---------------------------------------------------------------------------
// Where the user goes on from: the GD series and a stopped program
// ---------------------------------------------------------------------------

export interface SeriesContinuation {
  /** GD blocks the user finished (COMPLETED), in series order. */
  finishedGd: string[];
  /** The block after the furthest one finished; null before any, and after GD 8. */
  next: { slug: string; name: string; index: number; total: number } | null;
  /**
   * The whole plan done: the series' last block (GD 8) finished — the
   * latest copy of it, whose page offers "Repetir bloco". Never "start over
   * at the Adaptação" for a graduate.
   */
  done: { slug: string; programId: string } | null;
  /**
   * The program the user last stopped mid-block (archived, or ended by a
   * switch) with workouts, when nothing ended after it: "Retomar da semana N"
   * (getProgramRestart's week). Null when the last program to end was
   * finished, or one is running.
   */
  resume: {
    programId: string;
    programName: string;
    templateSlug: string | null;
    week: number;
    weeks: number | null;
  } | null;
}

/**
 * What the user goes on with after a block: the GD series' next block (not
 * the plan's start again), or the program stopped mid-way. One reading for
 * Today's no-program state, the recommendations and the program library's
 * GD card, so none of them sends a GD 1 graduate back to the Adaptação.
 */
export async function getSeriesContinuation(userId: string, now: Date = new Date()): Promise<SeriesContinuation> {
  const [completed, lastEnded, running] = await Promise.all([
    prisma.programEnrollment.findMany({
      where: { userId, status: "COMPLETED", program: { sourceTemplate: { slug: { in: [...GD_SERIES] } } } },
      orderBy: { endedAt: "desc" },
      select: { program: { select: { id: true, sourceTemplate: { select: { slug: true } } } } },
    }),
    prisma.programEnrollment.findFirst({
      where: { userId, status: { in: ["COMPLETED", "ABANDONED"] }, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      select: {
        status: true,
        program: { select: { id: true, name: true, status: true, sourceTemplate: { select: { slug: true } } } },
      },
    }),
    prisma.programEnrollment.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } }),
  ]);
  const order = (slug: string) => (GD_SERIES as readonly string[]).indexOf(slug);
  const finishedGd = [...new Set(completed.flatMap((e) => e.program.sourceTemplate?.slug ?? []))]
    .filter((slug) => order(slug) >= 0)
    .sort((a, b) => order(a) - order(b));
  const furthest = finishedGd.length > 0 ? finishedGd[finishedGd.length - 1] : null;
  const nextSlug = furthest ? seriesPosition(furthest)?.nextSlug ?? null : null;
  const lastSlug = GD_SERIES[GD_SERIES.length - 1];
  // Newest first: the latest finished copy of the last block.
  const lastDone = furthest === lastSlug ? completed.find((e) => e.program.sourceTemplate?.slug === lastSlug) : undefined;

  const stopped =
    !running && lastEnded?.status === "ABANDONED" && lastEnded.program.status !== "ACTIVE" ? lastEnded.program : null;
  const [nextTemplate, restart] = await Promise.all([
    nextSlug
      ? prisma.workoutTemplate.findFirst({ where: { slug: nextSlug, isPublished: true }, select: { slug: true, namePt: true } })
      : null,
    stopped ? getProgramRestart(userId, stopped.id, now) : null,
  ]);
  const pos = nextTemplate ? seriesPosition(nextTemplate.slug) : null;
  return {
    finishedGd,
    next: nextTemplate && pos ? { slug: nextTemplate.slug, name: nextTemplate.namePt, index: pos.index, total: pos.total } : null,
    done: lastDone ? { slug: lastSlug, programId: lastDone.program.id } : null,
    resume:
      stopped && restart?.resumable
        ? {
            programId: stopped.id,
            programName: stopped.name,
            templateSlug: stopped.sourceTemplate?.slug ?? null,
            week: restart.resumable.week,
            weeks: restart.resumable.weeks,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Picking a stopped program back up
// ---------------------------------------------------------------------------

export interface ProgramRestart {
  /**
   * An ended (not completed) enrollment with workouts: "Retomar da semana N".
   * `currentWeek` is the week counter to resume it with (block-progress
   * resumePoint: one step back for a block stopped in its last week).
   */
  resumable: { enrollmentId: string; week: number; weeks: number | null; currentWeek: number } | null;
  /** The program's last enrollment was completed: "Repetir bloco". */
  completed: { enrollmentId: string; completedAt: Date } | null;
}

/** How a program that isn't running can start again: from where it stopped, or over. */
export async function getProgramRestart(userId: string, programId: string, now: Date = new Date()): Promise<ProgramRestart> {
  const last = await prisma.programEnrollment.findFirst({
    where: { userId, programId, status: { not: "ACTIVE" } },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      currentWeek: true,
      startedAt: true,
      endedAt: true,
      program: { select: { durationWeeks: true } },
    },
  });
  if (!last) return { resumable: null, completed: null };
  if (last.status === "COMPLETED") {
    return { resumable: null, completed: { enrollmentId: last.id, completedAt: last.endedAt ?? last.startedAt } };
  }
  const lastWorkout = await prisma.workoutSession.findFirst({
    where: { userId, enrollmentId: last.id, ...FINISHED },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  if (!lastWorkout?.finishedAt) return { resumable: null, completed: null };
  const point = resumePoint({
    currentWeek: last.currentWeek,
    startedAt: last.startedAt,
    durationWeeks: last.program.durationWeeks,
    trainedThisWeek: lastWorkout.finishedAt >= startOfWeek(now),
    entryWeekTrained: await entryWeekWasTrained(prisma, { id: last.id, userId, startedAt: last.startedAt }),
  });
  return {
    resumable: { enrollmentId: last.id, week: point.week, weeks: last.program.durationWeeks, currentWeek: point.currentWeek },
    completed: null,
  };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/**
 * Records the 10th/25th/50th/100th workout as a PRIVATE MILESTONE activity —
 * once per number. The number is the workout's place among the user's
 * finished workouts (the summary's "Treino nº N"). Returns it, or null.
 */
export async function recordWorkoutMilestone(userId: string, sessionId: string): Promise<number | null> {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, name: true, status: true, finishedAt: true, totalWorkingSets: true },
  });
  if (!session || session.userId !== userId || session.status !== "COMPLETED" || !session.finishedAt) return null;
  const ordinal = await prisma.workoutSession.count({
    where: { userId, status: "COMPLETED", finishedAt: { lte: session.finishedAt } },
  });
  if (!isWorkoutMilestone(ordinal)) return null;
  const already = await prisma.activity.findFirst({
    where: { userId, type: "MILESTONE", summary: { path: ["count"], equals: ordinal } },
    select: { id: true },
  });
  if (already) return null;
  await prisma.activity.create({
    data: {
      userId,
      type: "MILESTONE",
      visibility: "PRIVATE",
      summary: workoutMilestoneSummary({
        count: ordinal,
        sessionId,
        sessionName: session.name,
        totalWorkingSets: session.totalWorkingSets ?? 0,
      }) as never,
    },
  });
  return ordinal;
}
