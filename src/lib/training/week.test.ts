import { describe, expect, it } from "vitest";
import {
  currentMonth,
  dayKey,
  daysInMonth,
  firstWeekdayOfMonth,
  formatAppDate,
  monthBounds,
  startOfWeek,
  zonedMidnight,
} from "./week";

describe("startOfWeek (America/Sao_Paulo)", () => {
  it("returns Monday 00:00 São Paulo (03:00 UTC) for a mid-week instant", () => {
    expect(startOfWeek(new Date("2026-09-25T12:00:00Z")).toISOString()).toBe("2026-09-21T03:00:00.000Z");
  });

  it("keeps Sunday late evening in the week that is ending, though UTC is already Monday", () => {
    // Sunday 27/09 23:30 in São Paulo = Monday 02:30 UTC.
    expect(startOfWeek(new Date("2026-09-28T02:30:00Z")).toISOString()).toBe("2026-09-21T03:00:00.000Z");
  });

  it("starts a new week at Monday 00:00 São Paulo", () => {
    expect(startOfWeek(new Date("2026-09-28T03:00:00Z")).toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });

  it("handles a Monday instant itself and other zones", () => {
    expect(startOfWeek(new Date("2026-09-21T10:00:00Z"), "UTC").toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });
});

// All assertions below compare absolute instants or zone-pinned strings, so
// they hold whatever TZ the test process runs in (prod servers run in UTC,
// dev machines in -03). Run with TZ=UTC / TZ=Asia/Tokyo to double-check.
describe("calendar-day helpers (America/Sao_Paulo)", () => {
  // Thursday 24/09/2026 21:30 in São Paulo = Friday 00:30 UTC.
  const eveningWorkout = new Date("2026-09-25T00:30:00Z");

  it("keys an evening workout to the São Paulo day, not the UTC day", () => {
    expect(dayKey(eveningWorkout)).toBe("2026-09-24");
    expect(dayKey(eveningWorkout, "UTC")).toBe("2026-09-25");
    expect(dayKey("2026-09-25T03:00:00Z")).toBe("2026-09-25");
  });

  it("formats dates on the São Paulo wall clock", () => {
    expect(formatAppDate(eveningWorkout)).toBe("24/09/2026");
    expect(formatAppDate(eveningWorkout.toISOString(), { day: "2-digit", month: "2-digit" })).toBe("24/09");
    expect(formatAppDate(eveningWorkout, { day: "2-digit", month: "2-digit" }, "UTC")).toBe("25/09");
  });

  it("builds São Paulo midnights, overflowing months like Date.UTC", () => {
    expect(zonedMidnight(2026, 8, 1).toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(zonedMidnight(2026, 12, 1).toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(zonedMidnight(2026, 0, 1, "UTC").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns [start, end) month bounds as São Paulo midnights", () => {
    const { start, end } = monthBounds(2026, 8); // September
    expect(start.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    // A workout on 30/09 22:00 São Paulo (01/10 01:00 UTC) is still September.
    const lastEvening = new Date("2026-10-01T01:00:00Z");
    expect(lastEvening >= start && lastEvening < end).toBe(true);
    const dec = monthBounds(2026, 11);
    expect(dec.end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("reads the current month on the São Paulo wall clock", () => {
    // 30/09 22:00 São Paulo — UTC has already turned to October.
    expect(currentMonth(new Date("2026-10-01T01:00:00Z"))).toEqual({ year: 2026, month0: 8 });
    expect(currentMonth(new Date("2026-10-01T01:00:00Z"), "UTC")).toEqual({ year: 2026, month0: 9 });
    // New Year's Eve 23:00 São Paulo is still December.
    expect(currentMonth(new Date("2027-01-01T02:00:00Z"))).toEqual({ year: 2026, month0: 11 });
  });

  it("computes the month grid independently of the process zone", () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 8)).toBe(30);
    expect(daysInMonth(2026, 11)).toBe(31);
    expect(firstWeekdayOfMonth(2026, 8)).toBe(2); // 01/09/2026 is a Tuesday
    expect(firstWeekdayOfMonth(2026, 10)).toBe(0); // 01/11/2026 is a Sunday
  });
});
