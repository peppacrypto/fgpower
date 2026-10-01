import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { emailTransport } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send";
import { withLease } from "@/lib/jobs/lease";
import { signLink } from "@/lib/links/signed";
import { sendPushToUser, type PushPayload } from "@/lib/push/send";
import { NOT_BANNED } from "@/lib/social/authorization";
import { dayKey, startOfWeek, wallClock, zonedMidnight } from "@/lib/training/week";
import { loadReminderUser, type LoadedReminderUser } from "./context";
import { openWorkoutPush, trainingDayPush } from "./copy";
import { buildDigest, digestHeaders } from "./digest";
import {
  DAY_FROM_MINUTES,
  DIGEST_FROM_MINUTES,
  DIGEST_UNTIL_MINUTES,
  decideReminder,
  notDueTodayUserIds,
  openPushHours,
  QUIET_FROM_MINUTES,
  reminderDeadline,
  settleDelivery,
  shouldPause,
  shouldResume,
  spMinutes,
  type Decision,
  type ReminderKindName,
} from "./rules";

/**
 * The reminder tick (W-017), every 5 minutes from the scheduler
 * (src/instrumentation.ts → POST /api/cron/reminders), one runner at a time
 * (lib/jobs/lease):
 *
 * 1. settle: SENT reminders become engaged (link opened, a workout started)
 *    or ignored (deadline passed); two ignored in a row pause the user; the
 *    first workout after a pause resumes them;
 * 2. housekeeping: stuck claims, old e-mail logs and deliveries, dead devices;
 * 3. candidates, prefiltered in SQL (at most MAX_USERS a tick), then per user
 *    in order digest → open workout → training day through the pure
 *    decideReminder (lib/reminders/rules). A final decision writes one row
 *    (SENT or SKIPPED + reason, unique per user, kind and period), so it is
 *    never made twice — across ticks, restarts and deploy overlap.
 *
 * Banned accounts get nothing. Missed windows are skipped, never sent late.
 */

export interface TickDeps {
  sendEmail: typeof sendEmail;
  sendPush: typeof sendPushToUser;
  /** Decide and report, write nothing, send nothing (no lease either). */
  dryRun: boolean;
  /** Only these users (the non-production test route); housekeeping is limited to them too. */
  onlyUserIds: string[] | null;
  /** E-mails at most every this many ms (Resend's default limit is 2 a second). */
  emailPacingMs: number;
  /** Stop taking new users after this long. */
  budgetMs: number;
}

export interface TickDecision {
  userId: string;
  kind: ReminderKindName;
  periodKey: string;
  action: "send" | "skip" | "failed" | "claimed-elsewhere";
  reason?: string;
}

export interface TickSummary {
  ran: boolean;
  now: string;
  dryRun: boolean;
  settled: { engaged: number; ignored: number; paused: number; resumed: number };
  housekeeping: { stuck: number; emails: number; deliveries: number; devices: number };
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  decisions: TickDecision[];
  tookMs: number;
}

export const REMINDER_LEASE = "reminders";
const LEASE_TTL_MS = 4 * 60_000;
const MAX_USERS = 500;
const STUCK_AFTER_MS = 15 * 60_000;
const EMAIL_RETENTION_MS = 30 * 86_400_000;
const DELIVERY_RETENTION_MS = 180 * 86_400_000;
const DEVICE_MAX_FAILURES = 5;
const DEVICE_STALE_MS = 30 * 86_400_000;
const OPEN_WORKOUT_TTL_S = 3 * 3600;
/** A digest can't be due before its day: skip re-reading those users until tomorrow. */
const notDueToday: Map<string, string> = ((globalThis as { __fgReminderMemo?: Map<string, string> }).__fgReminderMemo ??=
  new Map());

export async function runReminderTick(now: Date = new Date(), overrides: Partial<TickDeps> = {}): Promise<TickSummary> {
  const deps: TickDeps = {
    sendEmail,
    sendPush: sendPushToUser,
    dryRun: false,
    onlyUserIds: null,
    emailPacingMs: 550,
    budgetMs: 180_000,
    ...overrides,
  };
  if (deps.dryRun) return tick(now, deps);
  const leased = await withLease(REMINDER_LEASE, LEASE_TTL_MS, () => tick(now, deps));
  if (!leased.ran) return { ...emptySummary(now, deps), ran: false };
  return leased.result;
}

function emptySummary(now: Date, deps: TickDeps): TickSummary {
  return {
    ran: true,
    now: now.toISOString(),
    dryRun: deps.dryRun,
    settled: { engaged: 0, ignored: 0, paused: 0, resumed: 0 },
    housekeeping: { stuck: 0, emails: 0, deliveries: 0, devices: 0 },
    candidates: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    decisions: [],
    tookMs: 0,
  };
}

async function tick(now: Date, deps: TickDeps): Promise<TickSummary> {
  const started = Date.now();
  const summary = emptySummary(now, deps);
  summary.settled = await settle(now, deps);
  if (!deps.dryRun) summary.housekeeping = await housekeeping(deps);

  const candidates = await findCandidates(now, deps);
  const users = [...new Set([...candidates.digest, ...candidates.openWorkout, ...candidates.trainingDay])].slice(0, MAX_USERS);
  summary.candidates = users.length;
  const todayKey = dayKey(now);
  const mondayKey = dayKey(startOfWeek(now));
  let lastEmailAt = 0;

  for (const userId of users) {
    if (Date.now() - started > deps.budgetMs) break;
    const decidedOpen = candidates.openWorkout.has(userId) ? await decidedOpenSessions(userId, now) : new Set<string>();
    let loaded: LoadedReminderUser | null;
    try {
      loaded = await loadReminderUser(userId, now, { decidedOpenSessionIds: decidedOpen });
    } catch (err) {
      console.error("[reminders] context failed", userId, err);
      continue;
    }
    if (!loaded) continue;

    const kinds: ReminderKindName[] = [];
    if (candidates.digest.has(userId)) kinds.push("WEEKLY_DIGEST");
    if (candidates.openWorkout.has(userId)) kinds.push("OPEN_WORKOUT");
    if (candidates.trainingDay.has(userId)) kinds.push("TRAINING_DAY");

    for (const kind of kinds) {
      const decision = decideReminder(kind, loaded.ctx, now);
      const periodKey =
        kind === "WEEKLY_DIGEST" ? mondayKey : kind === "TRAINING_DAY" ? todayKey : (loaded.ctx.openWorkout?.sessionId ?? "");
      if (decision.action === "wait") {
        if (kind === "WEEKLY_DIGEST" && !deps.dryRun && !deps.onlyUserIds) notDueToday.set(`${kind}:${userId}`, todayKey);
        continue;
      }
      if (!periodKey) continue;
      const targetId = kind === "OPEN_WORKOUT" ? periodKey : null;
      if (decision.action === "skip") {
        summary.skipped += 1;
        summary.decisions.push({ userId, kind, periodKey, action: "skip", reason: decision.reason });
        if (!deps.dryRun) await writeSkip(userId, kind, periodKey, decision, targetId);
        continue;
      }
      if (deps.dryRun) {
        summary.decisions.push({ userId, kind, periodKey, action: "send" });
        continue;
      }
      if (kind === "WEEKLY_DIGEST") {
        const wait = lastEmailAt + deps.emailPacingMs - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastEmailAt = Date.now();
      }
      const outcome = await claimAndSend(userId, kind, periodKey, targetId, loaded, now, deps, mondayKey);
      summary.decisions.push({ userId, kind, periodKey, ...outcome });
      if (outcome.action === "send") {
        summary.sent += 1;
        loaded.ctx.sentAt.push(now); // the caps see it for this user's next kind
      } else if (outcome.action === "failed") summary.failed += 1;
    }
  }
  summary.tookMs = Date.now() - started;
  return summary;
}

// ---------------------------------------------------------------------------
// 1. Settle
// ---------------------------------------------------------------------------

async function settle(now: Date, deps: TickDeps): Promise<TickSummary["settled"]> {
  const result = { engaged: 0, ignored: 0, paused: 0, resumed: 0 };
  const only = deps.onlyUserIds ? { userId: { in: deps.onlyUserIds } } : {};
  const open = await prisma.reminderDelivery.findMany({
    where: { status: "SENT", engagedAt: null, ignoredAt: null, sentAt: { lte: now }, ...only },
    select: { id: true, userId: true, kind: true, sentAt: true, deadline: true, clickedAt: true, targetId: true },
    orderBy: { sentAt: "asc" },
    take: 2000,
  });
  const ignoredUsers = new Set<string>();
  for (const d of open) {
    if (!d.sentAt) continue;
    const deadline = d.deadline ?? reminderDeadline(d.sentAt);
    const [firstStart, target] = await Promise.all([
      prisma.workoutSession.findFirst({
        where: { userId: d.userId, startedAt: { gt: d.sentAt, lte: now } },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      }),
      d.kind === "OPEN_WORKOUT" && d.targetId
        ? prisma.workoutSession.findUnique({ where: { id: d.targetId }, select: { status: true } })
        : Promise.resolve(undefined),
    ]);
    const verdict = settleDelivery(
      {
        sentAt: d.sentAt,
        deadline,
        clickedAt: d.clickedAt,
        workoutStartedAt: firstStart?.startedAt ?? null,
        targetClosed: d.kind === "OPEN_WORKOUT" && (target === null || (target != null && target.status !== "IN_PROGRESS")),
      },
      now,
    );
    if (!verdict) continue;
    if ("engagedAt" in verdict) result.engaged += 1;
    else {
      result.ignored += 1;
      ignoredUsers.add(d.userId);
    }
    if (!deps.dryRun) await prisma.reminderDelivery.update({ where: { id: d.id }, data: verdict });
  }

  // Two ignored in a row: pause (silently).
  for (const userId of ignoredUsers) {
    const pref = await prisma.reminderPreference.findUnique({ where: { userId } });
    if (pref?.pausedAt) continue;
    const [recent, lastStart] = await Promise.all([
      prisma.reminderDelivery.findMany({
        where: { userId, status: "SENT", sentAt: { gt: pref?.resumedAt ?? new Date(0), lte: now } },
        orderBy: { sentAt: "desc" },
        take: 2,
        select: { sentAt: true, ignoredAt: true, engagedAt: true },
      }),
      lastWorkoutStart(userId, now),
    ]);
    const settledRecent = recent.flatMap((r) => (r.sentAt ? [{ ...r, sentAt: r.sentAt }] : []));
    // In a dry run this tick's ignoredAt isn't written: count it as written.
    const view = deps.dryRun ? settledRecent.map((r) => ({ ...r, ignoredAt: r.ignoredAt ?? (r.engagedAt ? null : now) })) : settledRecent;
    if (!shouldPause(view, { lastWorkoutStartAt: lastStart })) continue;
    result.paused += 1;
    if (!deps.dryRun) {
      await prisma.reminderPreference.upsert({
        where: { userId },
        create: { userId, pausedAt: now, pausedReason: "IGNORED" },
        update: { pausedAt: now, pausedReason: "IGNORED" },
      });
    }
  }

  // The first workout after a pause lifts it.
  const paused = await prisma.reminderPreference.findMany({
    where: { pausedAt: { not: null }, ...only },
    select: { userId: true, pausedAt: true },
    take: 2000,
  });
  for (const p of paused) {
    const lastStart = await lastWorkoutStart(p.userId, now);
    if (!shouldResume({ pausedAt: p.pausedAt, lastWorkoutStartAt: lastStart })) continue;
    result.resumed += 1;
    if (!deps.dryRun) {
      await prisma.reminderPreference.update({
        where: { userId: p.userId },
        data: { pausedAt: null, pausedReason: null, resumedAt: now },
      });
    }
  }
  return result;
}

async function lastWorkoutStart(userId: string, now: Date): Promise<Date | null> {
  const s = await prisma.workoutSession.findFirst({
    where: { userId, startedAt: { lte: now } },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return s?.startedAt ?? null;
}

// ---------------------------------------------------------------------------
// 2. Housekeeping (wall-clock ages, never the simulated "now")
// ---------------------------------------------------------------------------

async function housekeeping(deps: TickDeps): Promise<TickSummary["housekeeping"]> {
  const wall = Date.now();
  const only = deps.onlyUserIds ? { userId: { in: deps.onlyUserIds } } : {};
  const stuck = await prisma.reminderDelivery.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(wall - STUCK_AFTER_MS) }, ...only },
    data: { status: "FAILED", error: "STUCK" },
  });
  if (deps.onlyUserIds) return { stuck: stuck.count, emails: 0, deliveries: 0, devices: 0 };
  const [emails, deliveries, devices] = await Promise.all([
    prisma.emailMessage.deleteMany({ where: { createdAt: { lt: new Date(wall - EMAIL_RETENTION_MS) } } }),
    prisma.reminderDelivery.deleteMany({ where: { createdAt: { lt: new Date(wall - DELIVERY_RETENTION_MS) } } }),
    prisma.pushSubscription.deleteMany({
      where: {
        failureCount: { gte: DEVICE_MAX_FAILURES },
        OR: [{ lastSuccessAt: null }, { lastSuccessAt: { lt: new Date(wall - DEVICE_STALE_MS) } }],
      },
    }),
  ]);
  return { stuck: stuck.count, emails: emails.count, deliveries: deliveries.count, devices: devices.count };
}

// ---------------------------------------------------------------------------
// 3. Candidates and sending
// ---------------------------------------------------------------------------

async function findCandidates(now: Date, deps: TickDeps) {
  const minutes = spMinutes(now);
  const todayKey = dayKey(now);
  const mondayKey = dayKey(startOfWeek(now));
  const onlyUser = deps.onlyUserIds ? { userId: { in: deps.onlyUserIds } } : {};
  const memoOk = !deps.dryRun && !deps.onlyUserIds;

  const digest = new Set<string>();
  if (emailTransport() !== "off" && minutes >= DIGEST_FROM_MINUTES && minutes < DIGEST_UNTIL_MINUTES) {
    const notDue = memoOk ? notDueTodayUserIds(notDueToday, todayKey) : [];
    const rows = await prisma.reminderPreference.findMany({
      where: {
        emailDigest: true,
        emailUnsubscribedAt: null,
        emailBouncedAt: null,
        pausedAt: null,
        ...onlyUser,
        ...(notDue.length > 0 ? { NOT: { userId: { in: notDue } } } : {}),
        user: { ...NOT_BANNED, reminderDeliveries: { none: { kind: "WEEKLY_DIGEST", periodKey: mondayKey } } },
      },
      select: { userId: true },
      orderBy: { userId: "asc" },
      take: MAX_USERS,
    });
    for (const r of rows) if (!memoOk || notDueToday.get(`WEEKLY_DIGEST:${r.userId}`) !== todayKey) digest.add(r.userId);
  }

  const trainingDay = new Set<string>();
  const hours = openPushHours(minutes);
  if (hours.length > 0) {
    const rows = await prisma.reminderPreference.findMany({
      where: {
        pushHour: { in: hours },
        pausedAt: null,
        ...onlyUser,
        user: {
          ...NOT_BANNED,
          pushSubscriptions: { some: {} },
          reminderDeliveries: { none: { kind: "TRAINING_DAY", periodKey: todayKey } },
        },
      },
      select: { userId: true },
      orderBy: { userId: "asc" },
      take: MAX_USERS,
    });
    for (const r of rows) trainingDay.add(r.userId);
  }

  const openWorkout = new Set<string>();
  if (minutes >= DAY_FROM_MINUTES && minutes < QUIET_FROM_MINUTES) {
    const rows = await prisma.reminderPreference.findMany({
      where: {
        pausedAt: null,
        ...onlyUser,
        user: {
          ...NOT_BANNED,
          pushSubscriptions: { some: {} },
          workoutSessions: {
            some: { status: "IN_PROGRESS", startedAt: { gte: new Date(now.getTime() - 2 * 86_400_000), lte: now } },
          },
        },
      },
      select: { userId: true },
      orderBy: { userId: "asc" },
      take: MAX_USERS,
    });
    for (const r of rows) openWorkout.add(r.userId);
  }
  return { digest, trainingDay, openWorkout };
}

/** Open workouts of the user already reminded (or skipped) — one decision per workout. */
async function decidedOpenSessions(userId: string, now: Date): Promise<Set<string>> {
  const rows = await prisma.reminderDelivery.findMany({
    where: { userId, kind: "OPEN_WORKOUT", createdAt: { gte: new Date(now.getTime() - 4 * 86_400_000) } },
    select: { periodKey: true },
  });
  return new Set(rows.map((r) => r.periodKey));
}

function channelOf(kind: ReminderKindName) {
  return kind === "WEEKLY_DIGEST" ? ("EMAIL" as const) : ("PUSH" as const);
}

async function writeSkip(
  userId: string,
  kind: ReminderKindName,
  periodKey: string,
  decision: Extract<Decision, { action: "skip" }>,
  targetId: string | null,
) {
  try {
    await prisma.reminderDelivery.create({
      data: { userId, kind, channel: channelOf(kind), periodKey, status: "SKIPPED", skipReason: decision.reason, targetId },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Seconds from `now` to 21:30 in São Paulo today (a training-day push is stale after it). */
function secondsUntilQuiet(now: Date): number {
  const w = wallClock(now);
  const quiet = zonedMidnight(w.year, w.month - 1, w.day).getTime() + QUIET_FROM_MINUTES * 60_000;
  return Math.max(60, Math.round((quiet - now.getTime()) / 1000));
}

async function claimAndSend(
  userId: string,
  kind: ReminderKindName,
  periodKey: string,
  targetId: string | null,
  loaded: LoadedReminderUser,
  now: Date,
  deps: TickDeps,
  mondayKey: string,
): Promise<Pick<TickDecision, "action" | "reason">> {
  let row: { id: string };
  try {
    row = await prisma.reminderDelivery.create({
      data: { userId, kind, channel: channelOf(kind), periodKey, status: "PENDING", targetId },
      select: { id: true },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { action: "claimed-elsewhere" };
    throw err;
  }

  try {
    if (kind === "WEEKLY_DIGEST") {
      const message = await buildDigest(loaded, userId, row.id, now);
      const result = await deps.sendEmail({
        to: loaded.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        kind: "WEEKLY_DIGEST",
        userId,
        headers: digestHeaders(userId),
        idempotencyKey: `digest:${userId}:${mondayKey}`,
      });
      if (!result.ok) {
        await prisma.reminderDelivery.update({
          where: { id: row.id },
          data: { status: "FAILED", error: result.error.slice(0, 500), skipReason: result.error === "EMAIL_OFF" ? "EMAIL_OFF" : null },
        });
        return { action: "failed", reason: result.error };
      }
      await markSent(row.id, now, { subject: message.subject }, result.id);
      return { action: "send" };
    }

    let payload: PushPayload;
    let ttlSeconds: number;
    let topic: string;
    if (kind === "TRAINING_DAY") {
      const facts = loaded.trainingDay;
      if (!facts) throw new Error("no training day facts");
      const copy = trainingDayPush(facts);
      payload = { ...copy, url: trackedPath(userId, row.id, "/app/today"), tag: `fg-day-${periodKey}` };
      ttlSeconds = secondsUntilQuiet(now);
      topic = "training-day";
    } else {
      const session = loaded.openWorkouts.find((s) => s.id === periodKey);
      if (!session) throw new Error("open workout gone");
      const copy = openWorkoutPush({
        name: session.name,
        hoursOpen: (now.getTime() - session.startedAt.getTime()) / 3_600_000,
        registered: session.registered,
      });
      payload = { ...copy, url: trackedPath(userId, row.id, `/app/workout/${session.id}`), tag: `fg-open-${session.id}` };
      ttlSeconds = OPEN_WORKOUT_TTL_S;
      topic = "open-workout";
    }
    const sent = await deps.sendPush(userId, payload, { ttlSeconds, topic, urgency: "normal" });
    if (sent.delivered === 0) {
      await prisma.reminderDelivery.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          skipReason: "NO_DEVICE",
          error: `delivered 0, failed ${sent.failed}, removed ${sent.removed}`,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
      return { action: "failed", reason: "NO_DEVICE" };
    }
    await markSent(row.id, now, payload);
    return { action: "send" };
  } catch (err) {
    console.error("[reminders] send failed", kind, userId, err);
    await prisma.reminderDelivery
      .update({ where: { id: row.id }, data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : "error" } })
      .catch(() => undefined);
    return { action: "failed", reason: "ERROR" };
  }
}

function trackedPath(userId: string, deliveryId: string, to: string): string {
  return `/r/${signLink("click", { u: userId, d: deliveryId, to })}`;
}

async function markSent(id: string, now: Date, payload: object, providerId?: string) {
  await prisma.reminderDelivery.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: now,
      deadline: reminderDeadline(now),
      providerId: providerId ?? null,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}
