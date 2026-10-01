import "server-only";
import { prisma } from "@/lib/db";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { MEASUREMENT_KINDS, MIN_WEIGH_INS_FOR_AVERAGE, roundTenth, type BodyKind } from "@/lib/training/body-weight";

/**
 * The owner's body data (W-083): weigh-ins and circumferences, by São Paulo
 * day (BodyMetric.day, one row per kind and day). Read only for the owner's
 * own screens — Corpo, Progress, Today, the check-in — and the owner's
 * export; never by a public or social surface (/u, /t, the feed, OG images,
 * other people's e-mails).
 */

export interface BodyEntry {
  id: string;
  day: number;
  value: number;
  /** Logged by a workout's check-in (W-127): tagged "treino". */
  fromWorkout: boolean;
}

/** Weigh-ins from `sinceDay` on (every one when null — the newest 2000), oldest first. */
export async function getBodyweightPoints(userId: string, sinceDay: number | null): Promise<BodyEntry[]> {
  const rows = await prisma.bodyMetric.findMany({
    where: { userId, kind: "BODYWEIGHT", ...(sinceDay != null ? { day: { gte: sinceDay } } : {}) },
    orderBy: { day: "desc" },
    select: { id: true, day: true, value: true, sessionId: true },
    take: 2000,
  });
  return rows.reverse().map((r) => ({ id: r.id, day: r.day, value: r.value, fromWorkout: r.sessionId != null }));
}

/** The latest `limit` weigh-ins, newest first ("Pesagens"). */
export async function getRecentWeighIns(userId: string, limit = 14): Promise<BodyEntry[]> {
  const rows = await prisma.bodyMetric.findMany({
    where: { userId, kind: "BODYWEIGHT" },
    orderBy: { day: "desc" },
    select: { id: true, day: true, value: true, sessionId: true },
    take: limit,
  });
  return rows.map((r) => ({ id: r.id, day: r.day, value: r.value, fromWorkout: r.sessionId != null }));
}

export interface MeasurementSeries {
  kind: Exclude<BodyKind, "BODYWEIGHT">;
  /** The newest entry. */
  latest: BodyEntry;
  /** The oldest entry from `sinceDay` on, when older than the latest (the "desde" of the delta). */
  firstInWindow: BodyEntry | null;
  /** The latest 20 entries, newest first. */
  entries: BodyEntry[];
}

/** Entries kept per measurement (they come every few weeks: 20 is well over a year). */
const ENTRIES_PER_KIND = 20;

/**
 * Each circumference logged (waist, chest…), in the forms' order: its latest
 * value, the first one in the window, and its recent entries. Measurements
 * are rare — a handful per block — so one read of them all is small.
 */
export async function getMeasurements(userId: string, sinceDay: number | null): Promise<MeasurementSeries[]> {
  const rows = await prisma.bodyMetric.findMany({
    where: { userId, kind: { in: MEASUREMENT_KINDS.map((k) => k.kind) } },
    orderBy: [{ kind: "asc" }, { day: "desc" }],
    select: { id: true, kind: true, day: true, value: true, sessionId: true },
    take: 1000,
  });
  const out: MeasurementSeries[] = [];
  for (const { kind } of MEASUREMENT_KINDS) {
    const list = rows
      .filter((r) => r.kind === kind)
      .map((r) => ({ id: r.id, day: r.day, value: r.value, fromWorkout: r.sessionId != null }));
    if (list.length === 0) continue;
    const inWindow = sinceDay == null ? list : list.filter((e) => e.day >= sinceDay);
    const first = inWindow[inWindow.length - 1] ?? null;
    out.push({
      kind: kind as MeasurementSeries["kind"],
      latest: list[0],
      firstInWindow: first && first.id !== list[0].id ? first : null,
      entries: list.slice(0, ENTRIES_PER_KIND),
    });
  }
  return out;
}

export interface BodyweightGlance {
  /** Today's weigh-in (São Paulo day), if any. */
  todayKg: number | null;
  /** The latest weigh-in and its day. */
  lastKg: number | null;
  lastDay: number | null;
  /** The 7-day average ending today (null with fewer than 3 weigh-ins in it). */
  avg7: number | null;
  /** Weighed in the last 14 days: the habit is on (Today's row keeps offering it). */
  weighedRecently: boolean;
}

/**
 * The weight at a glance (Today's "PESO DE HOJE", Progress's Corpo card,
 * the check-in's placeholder): from the 21 newest weigh-ins.
 */
export async function getBodyweightGlance(userId: string, now: Date = new Date()): Promise<BodyweightGlance> {
  const rows = await prisma.bodyMetric.findMany({
    where: { userId, kind: "BODYWEIGHT" },
    orderBy: { day: "desc" },
    select: { day: true, value: true },
    take: 21,
  });
  const todayNo = dayNumberOf(now);
  const past = rows.filter((r) => r.day <= todayNo);
  const last = past[0] ?? null;
  const week = past.filter((r) => r.day >= todayNo - 6);
  return {
    todayKg: last && last.day === todayNo ? last.value : null,
    lastKg: last?.value ?? null,
    lastDay: last?.day ?? null,
    avg7: week.length >= MIN_WEIGH_INS_FOR_AVERAGE ? roundTenth(week.reduce((a, r) => a + r.value, 0) / week.length) : null,
    weighedRecently: last != null && last.day >= todayNo - 14,
  };
}

/** The latest weigh-in on or before a day (the check-in's placeholder for that workout's day). */
export async function getWeighInOnOrBefore(userId: string, day: number) {
  return prisma.bodyMetric.findFirst({
    where: { userId, kind: "BODYWEIGHT", day: { lte: day } },
    orderBy: { day: "desc" },
    select: { day: true, value: true, sessionId: true },
  });
}
