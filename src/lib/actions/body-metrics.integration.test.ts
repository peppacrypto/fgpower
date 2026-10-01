import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { getBodyweightGlance, getMeasurements } from "@/lib/data/body-metrics";

/**
 * Logging weight and measurements (W-083) against the real local Postgres:
 * one row per kind and São Paulo day (the latest value wins), dates up to a
 * year back and never ahead, each kind's range, and a delete that only ever
 * touches the user's own rows.
 */

const RUN_ID = `body-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const OTHER_ID = `${RUN_ID}-o`;
let signedIn: string | null = USER_ID;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!signedIn) throw new Error("UNAUTHORIZED");
    return { id: signedIn };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const actions = await import("./body-metrics");
const DAY_MS = 86_400_000;
const isoOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

beforeAll(async () => {
  for (const id of [USER_ID, OTHER_ID]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_ID] } } });
  await prisma.$disconnect();
});

describe("saveBodyMetrics", () => {
  it("keeps one row per kind and day: the latest value wins", async () => {
    const today = dayNumberOf(new Date());
    expect(await actions.saveBodyMetrics({ entries: [{ kind: "BODYWEIGHT", value: 81.44 }] })).toMatchObject({ ok: true });
    expect(await actions.saveBodyMetrics({ entries: [{ kind: "BODYWEIGHT", value: 81.2 }, { kind: "WAIST", value: 84 }] })).toMatchObject({
      ok: true,
    });
    const rows = await prisma.bodyMetric.findMany({ where: { userId: USER_ID }, orderBy: { kind: "asc" } });
    expect(rows.map((r) => [r.kind, r.value, r.unit, r.day])).toEqual([
      ["BODYWEIGHT", 81.2, "kg", today],
      ["WAIST", 84, "cm", today],
    ]);
    expect(await getBodyweightGlance(USER_ID)).toMatchObject({ todayKg: 81.2, lastKg: 81.2, weighedRecently: true, avg7: null });
  });

  it("back-dates up to a year, at that day's noon; never ahead, never further back", async () => {
    const today = dayNumberOf(new Date());
    expect(await actions.saveBodyMetrics({ date: isoOf(today - 3), entries: [{ kind: "BODYWEIGHT", value: 82 }] })).toMatchObject({ ok: true });
    const row = await prisma.bodyMetric.findFirstOrThrow({ where: { userId: USER_ID, kind: "BODYWEIGHT", day: today - 3 } });
    expect(dayNumberOf(row.measuredAt)).toBe(today - 3);
    expect(await actions.saveBodyMetrics({ date: isoOf(today + 1), entries: [{ kind: "BODYWEIGHT", value: 82 }] })).toEqual({
      ok: false,
      error: "A data não pode ser no futuro.",
      field: "date",
    });
    expect(await actions.saveBodyMetrics({ date: isoOf(today - 367), entries: [{ kind: "BODYWEIGHT", value: 82 }] })).toMatchObject({
      ok: false,
      field: "date",
    });
    expect(await actions.saveBodyMetrics({ date: "2026-02-30", entries: [{ kind: "BODYWEIGHT", value: 82 }] })).toMatchObject({
      ok: false,
      error: "Confira a data.",
    });
  });

  it("refuses a value out of its range, CUSTOM, nothing to save, and a signed-out caller", async () => {
    expect(await actions.saveBodyMetrics({ entries: [{ kind: "BODYWEIGHT", value: 814 }] })).toEqual({
      ok: false,
      error: "Confira o valor: entre 25 e 350 kg",
      field: "BODYWEIGHT",
    });
    expect(await actions.saveBodyMetrics({ entries: [{ kind: "ARM", value: 90 }] })).toMatchObject({ ok: false, field: "ARM" });
    expect(await actions.saveBodyMetrics({ entries: [{ kind: "CUSTOM", value: 40 }] })).toMatchObject({ ok: false });
    expect(await actions.saveBodyMetrics({ entries: [] })).toMatchObject({ ok: false });
    signedIn = null;
    try {
      expect(await actions.saveBodyMetrics({ entries: [{ kind: "BODYWEIGHT", value: 80 }] })).toEqual({
        ok: false,
        error: SESSION_EXPIRED_ERROR,
      });
      expect(await actions.deleteBodyMetric("x")).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    } finally {
      signedIn = USER_ID;
    }
  });

  it("dates a weigh-in at 23:30 in São Paulo on that day (not the next UTC one)", () => {
    // 23:30 BRT on 2026-09-27 is 02:30 UTC on the 28th.
    expect(dayNumberOf(new Date("2026-09-28T02:30:00Z"))).toBe(Date.UTC(2026, 8, 27) / DAY_MS);
  });

  it("reads each measurement's latest value and its change in the window", async () => {
    const today = dayNumberOf(new Date());
    await actions.saveBodyMetrics({ date: isoOf(today - 20), entries: [{ kind: "WAIST", value: 85.5 }] });
    const [waist] = await getMeasurements(USER_ID, today - 30);
    expect(waist).toMatchObject({ kind: "WAIST", latest: { value: 84, day: today }, firstInWindow: { value: 85.5, day: today - 20 } });
    expect(waist.entries.map((e) => e.value)).toEqual([84, 85.5]);
    const [recent] = await getMeasurements(USER_ID, today - 5);
    expect(recent.firstInWindow).toBeNull();
  });
});

describe("deleteBodyMetric", () => {
  it("deletes the user's own row, and never someone else's", async () => {
    const theirs = await prisma.bodyMetric.create({
      data: { userId: OTHER_ID, kind: "BODYWEIGHT", value: 70, day: dayNumberOf(new Date()) },
    });
    expect(await actions.deleteBodyMetric(theirs.id)).toEqual({ ok: true });
    expect(await prisma.bodyMetric.count({ where: { id: theirs.id } })).toBe(1);
    const mine = await prisma.bodyMetric.findFirstOrThrow({ where: { userId: USER_ID, kind: "WAIST" } });
    expect(await actions.deleteBodyMetric(mine.id)).toEqual({ ok: true });
    expect(await prisma.bodyMetric.count({ where: { id: mine.id } })).toBe(0);
  });
});
