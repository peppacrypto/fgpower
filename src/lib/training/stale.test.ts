import { describe, expect, it } from "vitest";
import {
  assessOpenSession,
  boutSeconds,
  formatSpDate,
  formatSpDaysAgo,
  formatSpTime,
  formatSpWeekdayDate,
  isStaleSession,
  setBouts,
  spDayKey,
  staleSaveTiming,
  type OpenSetRow,
} from "./stale";

describe("isStaleSession (America/Sao_Paulo)", () => {
  const now = new Date("2026-09-25T20:00:00Z"); // Friday 17:00 in São Paulo

  it("is fresh for a workout started an hour ago the same day", () => {
    expect(isStaleSession(new Date("2026-09-25T19:00:00Z"), now)).toBe(false);
  });

  it("is stale when started on an earlier São Paulo day, even minutes ago", () => {
    // Thursday 23:50 → Friday 00:10 in São Paulo.
    expect(isStaleSession(new Date("2026-09-26T02:50:00Z"), new Date("2026-09-26T03:10:00Z"))).toBe(true);
  });

  it("follows the São Paulo day, not UTC's", () => {
    // Friday 21:30 São Paulo is already Saturday in UTC — still the same day there.
    expect(isStaleSession(new Date("2026-09-26T00:30:00Z"), new Date("2026-09-26T01:00:00Z"))).toBe(false);
  });

  it("is stale after more than 8 h on the same day", () => {
    expect(isStaleSession(new Date("2026-09-25T11:59:00Z"), now)).toBe(true);
    expect(isStaleSession(new Date("2026-09-25T12:01:00Z"), now)).toBe(false);
  });

  it("is stale for a workout opened days ago", () => {
    expect(isStaleSession(new Date("2026-09-20T13:00:00Z"), now)).toBe(true);
  });
});

describe("São Paulo day formatting", () => {
  it("keys and formats the São Paulo calendar day", () => {
    // Saturday 19/09 22:30 in São Paulo = Sunday 01:30 UTC.
    const d = new Date("2026-09-20T01:30:00Z");
    expect(spDayKey(d)).toBe("2026-09-19");
    expect(formatSpDate(d)).toBe("19/09");
    expect(formatSpWeekdayDate(d)).toBe("sáb, 19/09");
    expect(formatSpTime(d)).toBe("22:30");
  });
});

const at = (iso: string) => new Date(iso);
const minutes = (n: number) => n * 60 * 1000;

describe("setBouts / boutSeconds", () => {
  it("splits sets more than 2 h apart into separate bouts, in time order", () => {
    const bouts = setBouts([
      at("2026-09-24T10:30:00Z"),
      at("2026-09-21T10:05:00Z"),
      at("2026-09-21T10:00:00Z"),
      at("2026-09-21T10:40:00Z"),
      at("2026-09-24T10:31:00Z"),
    ]);
    expect(bouts.map((b) => [b.start.toISOString(), b.end.toISOString()])).toEqual([
      ["2026-09-21T10:00:00.000Z", "2026-09-21T10:40:00.000Z"],
      ["2026-09-24T10:30:00.000Z", "2026-09-24T10:31:00.000Z"],
    ]);
  });

  it("times a bout first to last set, at least a minute and at most 4 h", () => {
    expect(boutSeconds({ start: at("2026-09-21T10:00:00Z"), end: at("2026-09-21T10:40:00Z") })).toBe(2400);
    expect(boutSeconds({ start: at("2026-09-21T10:00:00Z"), end: at("2026-09-21T10:00:00Z") })).toBe(60);
    const sixHours = setBouts(Array.from({ length: 7 }, (_, i) => new Date(at("2026-09-21T08:00:00Z").getTime() + i * minutes(60))));
    expect(sixHours).toHaveLength(1);
    expect(boutSeconds(sixHours[0])).toBe(4 * 3600);
  });
});

describe("staleSaveTiming", () => {
  const startedAt = at("2026-09-21T09:55:00Z"); // Monday 06:55 in São Paulo
  const now = at("2026-09-24T21:00:00Z");

  it("dates a workout left open at its last set, timed by its sets", () => {
    const t = staleSaveTiming(startedAt, [at("2026-09-21T10:00:00Z"), at("2026-09-21T10:45:00Z")], now);
    expect(t.finishedAt.toISOString()).toBe("2026-09-21T10:45:00.000Z");
    expect(t.durationSeconds).toBe(45 * 60);
  });

  it("ignores sets done days later (continued today) for its date and duration", () => {
    const t = staleSaveTiming(
      startedAt,
      [at("2026-09-21T10:00:00Z"), at("2026-09-21T10:05:00Z"), at("2026-09-24T20:50:00Z")],
      now,
    );
    expect(t.finishedAt.toISOString()).toBe("2026-09-21T10:05:00.000Z");
    expect(t.durationSeconds).toBe(5 * 60);
  });

  it("keeps a workout crossing midnight whole", () => {
    // Friday 23:30 → Saturday 00:40 in São Paulo.
    const t = staleSaveTiming(
      at("2026-09-26T02:30:00Z"),
      [at("2026-09-26T02:35:00Z"), at("2026-09-26T03:10:00Z"), at("2026-09-26T03:40:00Z")],
      at("2026-09-27T15:00:00Z"),
    );
    expect(t.finishedAt.toISOString()).toBe("2026-09-26T03:40:00.000Z");
    expect(t.durationSeconds).toBe(65 * 60);
  });

  it("falls back to start + 1 h without set times, never later than now", () => {
    expect(staleSaveTiming(startedAt, [], now)).toEqual({ finishedAt: at("2026-09-21T10:55:00Z"), durationSeconds: 3600 });
    const soon = at("2026-09-21T10:15:00Z");
    expect(staleSaveTiming(startedAt, [], soon)).toEqual({ finishedAt: soon, durationSeconds: 20 * 60 });
  });
});

describe("assessOpenSession", () => {
  const row = (o: Partial<OpenSetRow>): OpenSetRow => ({
    isCompleted: false,
    completedAt: null,
    updatedAt: at("2026-09-21T09:55:00Z"),
    weightKg: null,
    reps: null,
    wasSkipped: false,
    ...o,
  });
  const done = (iso: string) => row({ isCompleted: true, completedAt: at(iso), updatedAt: at(iso), weightKg: 40, reps: 10 });

  it("marks a workout from an earlier day, untouched since, as left open and dated on its own day", () => {
    const s = assessOpenSession(
      at("2026-09-21T09:55:00Z"),
      [done("2026-09-21T10:00:00Z"), done("2026-09-21T10:05:00Z"), row({})],
      at("2026-09-24T21:00:00Z"),
    );
    expect(s.leftOpen).toBe(true);
    expect(s.showSince).toBe(true);
    expect(s.saveAs.finishedAt.toISOString()).toBe("2026-09-21T10:05:00.000Z");
  });

  it("a workout left open and continued today is no longer left open, but keeps its own day to save on", () => {
    const s = assessOpenSession(
      at("2026-09-21T09:55:00Z"),
      [
        done("2026-09-21T10:00:00Z"),
        done("2026-09-21T10:05:00Z"),
        // Typed today, never ✓'d.
        row({ updatedAt: at("2026-09-24T20:58:00Z"), weightKg: 40, reps: 8 }),
      ],
      at("2026-09-24T21:00:00Z"),
    );
    expect(s.leftOpen).toBe(false);
    expect(s.showSince).toBe(true);
    expect(s.lastActivity?.toISOString()).toBe("2026-09-24T20:58:00.000Z");
    expect(spDayKey(s.saveAs.finishedAt)).toBe("2026-09-21");
  });

  it("a workout started before midnight and still being logged is live: it keeps its clock", () => {
    // Friday 23:30 → Saturday 00:05 in São Paulo, last set 00:02.
    const s = assessOpenSession(
      at("2026-09-26T02:30:00Z"),
      [done("2026-09-26T02:40:00Z"), done("2026-09-26T03:02:00Z")],
      at("2026-09-26T03:05:00Z"),
    );
    expect(s.leftOpen).toBe(false);
    expect(s.showSince).toBe(false);
  });

  it("rows in a skipped exercise count only when ✓'d; empty rows are not activity", () => {
    const s = assessOpenSession(
      at("2026-09-21T09:55:00Z"),
      [
        done("2026-09-21T10:00:00Z"),
        row({ updatedAt: at("2026-09-21T11:30:00Z"), weightKg: 40, reps: 8, wasSkipped: true }),
        row({ updatedAt: at("2026-09-24T20:59:00Z") }),
      ],
      at("2026-09-24T21:00:00Z"),
    );
    expect(s.leftOpen).toBe(true);
    expect(s.lastActivity?.toISOString()).toBe("2026-09-21T11:30:00.000Z");
    expect(s.saveAs.finishedAt.toISOString()).toBe("2026-09-21T10:00:00.000Z");
  });
});

describe("formatSpDaysAgo (America/Sao_Paulo)", () => {
  const now = new Date("2026-09-25T20:00:00Z"); // Friday 17:00 in São Paulo

  it("counts São Paulo calendar days, not 24-hour spans", () => {
    expect(formatSpDaysAgo(new Date("2026-09-25T12:00:00Z"), now)).toBe("hoje");
    // Thursday 22:30 in São Paulo is 01:30 UTC on Friday: still "ontem".
    expect(formatSpDaysAgo(new Date("2026-09-26T01:30:00Z"), new Date("2026-09-26T20:00:00Z"))).toBe("ontem");
    expect(formatSpDaysAgo(new Date("2026-09-16T12:00:00Z"), now)).toBe("há 9 dias");
  });

  it("switches to weeks, months and years for older sessions", () => {
    expect(formatSpDaysAgo(new Date("2026-09-04T12:00:00Z"), now)).toBe("há 3 semanas");
    expect(formatSpDaysAgo(new Date("2026-06-25T12:00:00Z"), now)).toBe("há 3 meses");
    expect(formatSpDaysAgo(new Date("2025-06-25T12:00:00Z"), now)).toBe("há mais de 1 ano");
  });
});
