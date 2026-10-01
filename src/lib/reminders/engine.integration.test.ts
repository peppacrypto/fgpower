import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { dayKey, startOfWeek } from "@/lib/training/week";
import type { sendEmail } from "@/lib/email/send";
import type { PushPayload, PushOptions, PushResult } from "@/lib/push/send";
import { runReminderTick, type TickDeps } from "./engine";

/**
 * The reminder tick against the real local Postgres, at fixed times of the
 * current calendar week (São Paulo), with fake transports and the tick
 * limited to this run's users (the dev database has others).
 */

const RUN = `rem-${Date.now()}`;
const DAY_MS = 86_400_000;
const MON = startOfWeek(new Date());
/** `day` days after this week's Monday (0 = Monday), at hh:mm São Paulo. */
const at = (day: number, h: number, m = 0) => new Date(MON.getTime() + day * DAY_MS + h * 3_600_000 + m * 60_000);

const users = {
  sqs: `${RUN}-sqs`, // SEG·QUA·SEX program, digest + push
  gd: `${RUN}-gd`, // SEG–SEX program, push only
  deload: `${RUN}-deload`, // applied deload this week
  started: `${RUN}-started`, // started a workout at 17:00
  pause: `${RUN}-pause`, // ignores reminders
  race: `${RUN}-race`, // two ticks at once
  open: `${RUN}-open`, // a workout left open
  banned: `${RUN}-banned`,
};

let bench: string;
const pushes: { userId: string; payload: PushPayload; opts: PushOptions }[] = [];
const emails: Parameters<typeof sendEmail>[0][] = [];

const fakePush = async (userId: string, payload: PushPayload, opts: PushOptions): Promise<PushResult> => {
  pushes.push({ userId, payload, opts });
  return { delivered: 1, failed: 0, removed: 0 };
};
const fakeEmail = (async (m: Parameters<typeof sendEmail>[0]) => {
  emails.push(m);
  return { ok: true as const, id: `fake_${emails.length}` };
}) as typeof sendEmail;

function tick(now: Date, only: string[], extra: Partial<TickDeps> = {}) {
  return runReminderTick(now, { sendPush: fakePush, sendEmail: fakeEmail, onlyUserIds: only, emailPacingMs: 0, ...extra });
}

async function rows(userId: string) {
  return prisma.reminderDelivery.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { kind: true, periodKey: true, status: true, skipReason: true, sentAt: true, payload: true, id: true },
  });
}

/** The user opened every reminder sent so far (engaged: no pause). */
async function clickAll(userId: string, when: Date) {
  await prisma.reminderDelivery.updateMany({ where: { userId, status: "SENT", clickedAt: null }, data: { clickedAt: when } });
}

async function makeUser(
  id: string,
  p: { days: string[]; weekdays: number[]; preferredDays: number[]; daysPerWeek: number; digest?: boolean; push?: boolean },
) {
  await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({
    data: { userId: id, displayName: "Ana Teste", daysPerWeek: p.daysPerWeek, preferredDays: p.preferredDays, onboardingCompletedAt: new Date() },
  });
  const program = await prisma.userProgram.create({
    data: {
      userId: id,
      name: "Plano Teste",
      status: "ACTIVE",
      daysPerWeek: p.daysPerWeek,
      durationWeeks: 8,
      days: {
        create: p.days.map((name, dayIndex) => ({
          name,
          dayIndex,
          weekday: p.weekdays[dayIndex],
          exercises: { create: [{ exerciseId: bench, sortOrder: 0, rirTarget: 2 }] },
        })),
      },
    },
  });
  const enrollment = await prisma.programEnrollment.create({
    data: { userId: id, programId: program.id, status: "ACTIVE", currentWeek: 4, startedAt: new Date(MON.getTime() - 21 * DAY_MS), programSnapshot: {} },
  });
  await prisma.reminderPreference.create({ data: { userId: id, emailDigest: p.digest ?? false, pushHour: 18 } });
  if (p.push !== false) {
    await prisma.pushSubscription.create({
      data: { userId: id, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: "B".repeat(87), auth: "a".repeat(22) },
    });
  }
  return { programId: program.id, enrollmentId: enrollment.id };
}

const SQS = { days: ["Sessão A", "Sessão B", "Sessão C"], weekdays: [1, 3, 5], preferredDays: [1, 3, 5], daysPerWeek: 3 };
const GD = {
  days: ["Segunda — Superior", "Terça — Inferior", "Quarta — Peito", "Quinta — Puxar", "Sexta — Pernas"],
  weekdays: [1, 2, 3, 4, 5],
  preferredDays: [1, 2, 3, 4, 5],
  daysPerWeek: 5,
};

beforeAll(async () => {
  bench = (await prisma.exercise.findUniqueOrThrow({ where: { slug: "barbell-bench-press-medium-grip" } })).id;
  await makeUser(users.sqs, { ...SQS, digest: true });
  await makeUser(users.gd, GD);
  const deload = await makeUser(users.deload, { ...SQS, digest: true });
  await prisma.programEnrollment.update({ where: { id: deload.enrollmentId }, data: { deloadMondays: [mondayOf(dayNumberOf(MON))] } });
  await makeUser(users.started, SQS);
  await makeUser(users.pause, SQS);
  await makeUser(users.race, SQS);
  await makeUser(users.open, SQS);
  await makeUser(users.banned, SQS);
  await prisma.user.update({ where: { id: users.banned }, data: { banned: true } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: RUN } } });
  await prisma.$disconnect();
});

describe("runReminderTick", () => {
  it("SEG·QUA·SEX with digest + push: Mon digest, Mon push capped, Tue rest, Wed and Fri sent", async () => {
    const u = users.sqs;
    await tick(at(0, 7, 5), [u]);
    let r = await rows(u);
    expect(r.map((x) => [x.kind, x.status])).toEqual([["WEEKLY_DIGEST", "SENT"]]);
    expect(r[0].periodKey).toBe(dayKey(MON));
    const digest = emails.find((e) => e.to === `${u}@fgpower.test`)!;
    expect(digest.kind).toBe("WEEKLY_DIGEST");
    expect(digest.subject).toMatch(/^Semana 4 de 8 · Plano Teste — hoje: Sessão A$/);
    expect(digest.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(digest.idempotencyKey).toBe(`digest:${u}:${dayKey(MON)}`);
    expect(digest.text).toContain("Dias: SEG · QUA · SEX");
    await clickAll(u, at(0, 8));

    await tick(at(0, 18, 5), [u]);
    r = await rows(u);
    expect(r[1]).toMatchObject({ kind: "TRAINING_DAY", status: "SKIPPED", skipReason: "CAP_DAY", periodKey: dayKey(at(0, 12)) });

    await tick(at(1, 18, 5), [u]);
    expect((await rows(u))[2]).toMatchObject({ kind: "TRAINING_DAY", status: "SKIPPED", skipReason: "REST_DAY" });

    await tick(at(2, 18, 5), [u]);
    r = await rows(u);
    expect(r[3]).toMatchObject({ kind: "TRAINING_DAY", status: "SENT" });
    const push = pushes.filter((p) => p.userId === u).at(-1)!;
    expect(push.payload.title).toBe("Hoje: Sessão A");
    // No weekly guidance in this plan: no RIR target in the line.
    expect(push.payload.body).toBe("Plano Teste · Semana 4 de 8 · 1 exercício");
    expect(push.payload.url).toMatch(/^\/r\/[\w-]+\.[\w-]+$/);
    // Until 21:30 São Paulo: 3 h 25 min after 18:05.
    expect(push.opts.ttlSeconds).toBe(3 * 3600 + 25 * 60);
    await clickAll(u, at(2, 19));

    await tick(at(4, 18, 5), [u]);
    r = await rows(u);
    expect(r[4]).toMatchObject({ kind: "TRAINING_DAY", status: "SENT" });
    // A second tick in the same window decides nothing new.
    await tick(at(4, 18, 30), [u]);
    expect(await rows(u)).toHaveLength(5);
  });

  it("SEG–SEX, push only: Mon, Tue, Wed sent, Thu capped by the week", async () => {
    const u = users.gd;
    for (const day of [0, 1, 2, 3]) {
      await tick(at(day, 18, 10), [u]);
      await clickAll(u, at(day, 19));
    }
    const r = await rows(u);
    expect(r.map((x) => x.status)).toEqual(["SENT", "SENT", "SENT", "SKIPPED"]);
    expect(r[3].skipReason).toBe("CAP_WEEK");
    expect(r.every((x) => x.kind === "TRAINING_DAY")).toBe(true);
  });

  it("a deload week (applied): no digest, no push", async () => {
    const u = users.deload;
    await tick(at(0, 7, 5), [u]);
    await tick(at(0, 18, 5), [u]);
    const r = await rows(u);
    expect(r.map((x) => [x.kind, x.skipReason])).toEqual([
      ["WEEKLY_DIGEST", "DELOAD"],
      ["TRAINING_DAY", "DELOAD"],
    ]);
    expect(emails.some((e) => e.to === `${u}@fgpower.test`)).toBe(false);
  });

  it("a workout started at 17:00: no training-day push at 18:05", async () => {
    const u = users.started;
    await prisma.workoutSession.create({
      data: { userId: u, name: "Sessão A", status: "IN_PROGRESS", startedAt: at(2, 17) },
    });
    await tick(at(2, 18, 5), [u]);
    expect((await rows(u))[0]).toMatchObject({ kind: "TRAINING_DAY", status: "SKIPPED", skipReason: "STARTED_TODAY" });
  });

  it("two ignored in a row pause the reminders; the next workout resumes them", async () => {
    const u = users.pause;
    await tick(at(0, 18, 5), [u]); // SENT, deadline Wed 00:00
    await tick(at(2, 18, 5), [u]); // Monday's ignored; SENT
    expect((await rows(u)).map((x) => x.status)).toEqual(["SENT", "SENT"]);
    expect((await prisma.reminderPreference.findUniqueOrThrow({ where: { userId: u } })).pausedAt).toBeNull();

    const summary = await tick(at(4, 18, 5), [u]); // Wednesday's ignored too: paused, nothing sent
    expect(summary.settled.paused).toBe(1);
    const r = await rows(u);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.status === "SENT")).toBe(true);
    const paused = await prisma.reminderPreference.findUniqueOrThrow({ where: { userId: u } });
    expect(paused).toMatchObject({ pausedReason: "IGNORED" });
    expect(paused.pausedAt).not.toBeNull();

    await prisma.workoutSession.create({
      data: { userId: u, name: "Sessão C", status: "COMPLETED", startedAt: at(4, 19), finishedAt: at(4, 20), totalWorkingSets: 3 },
    });
    const after = await tick(at(4, 20, 5), [u]);
    expect(after.settled.resumed).toBe(1);
    const resumed = await prisma.reminderPreference.findUniqueOrThrow({ where: { userId: u } });
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.resumedAt?.getTime()).toBe(at(4, 20, 5).getTime());
  });

  it("two ticks at once: one runs, one row", async () => {
    const u = users.race;
    const [a, b] = await Promise.all([tick(at(0, 18, 5), [u]), tick(at(0, 18, 5), [u])]);
    expect([a.ran, b.ran].filter(Boolean)).toHaveLength(1);
    expect(await rows(u)).toHaveLength(1);
  });

  it("an open workout 3–20 h after its last set: one reminder, not in the quiet hours", async () => {
    const u = users.open;
    const session = await prisma.workoutSession.create({
      data: { userId: u, name: "Sessão B", status: "IN_PROGRESS", startedAt: at(2, 9) },
    });
    const log = await prisma.workoutExerciseLog.create({
      data: { sessionId: session.id, userId: u, exerciseId: bench, sortOrder: 0, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
    });
    await prisma.setLog.create({
      data: { userId: u, sessionId: session.id, exerciseLogId: log.id, exerciseId: bench, setNumber: 1, weightKg: 60, reps: 8, isCompleted: true, completedAt: at(2, 9, 20) },
    });
    await prisma.setLog.updateMany({ where: { sessionId: session.id }, data: { updatedAt: at(2, 9, 20) } });

    await tick(at(2, 11), [u]); // 1 h 40 min idle: not yet
    expect(await rows(u)).toHaveLength(0);
    await tick(at(2, 12, 30), [u]);
    const r = await rows(u);
    expect(r[0]).toMatchObject({ kind: "OPEN_WORKOUT", status: "SENT", periodKey: session.id });
    const push = pushes.filter((p) => p.userId === u).at(-1)!;
    expect(push.payload.title).toBe("Treino aberto: Sessão B");
    expect(push.payload.body).toBe("Aberto há 3 h com 1 série registrada. Toque para finalizar ou descartar.");
    expect(push.opts.ttlSeconds).toBe(3 * 3600);
    // Once per workout; the 18h push that day isn't sent (a workout was started today).
    await tick(at(2, 18, 5), [u]);
    expect((await rows(u)).map((x) => [x.kind, x.status, x.skipReason])).toEqual([
      ["OPEN_WORKOUT", "SENT", null],
      ["TRAINING_DAY", "SKIPPED", "STARTED_TODAY"],
    ]);
  });

  it("banned accounts get nothing; a dry run writes nothing", async () => {
    await tick(at(0, 18, 5), [users.banned]);
    expect(await rows(users.banned)).toHaveLength(0);

    const u = users.gd;
    const before = await rows(u);
    const dry = await tick(at(4, 18, 5), [u], { dryRun: true });
    expect(dry.decisions.some((d) => d.userId === u && d.kind === "TRAINING_DAY")).toBe(true);
    expect(await rows(u)).toEqual(before);
  });
});
