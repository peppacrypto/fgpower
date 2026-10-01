import { describe, expect, it } from "vitest";
import { formatFullDateTime, formatRelativeTime } from "./relative-time";

const S = "\u00a0";
/** A São Paulo wall-clock moment (UTC−3, no DST since 2019). */
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe("formatRelativeTime", () => {
  const now = sp("2026-09-28T20:30:00");

  it("says 'agora' under a minute, and for a clock a little ahead", () => {
    expect(formatRelativeTime(sp("2026-09-28T20:29:30"), now)).toBe("agora");
    expect(formatRelativeTime(sp("2026-09-28T20:31:00"), now)).toBe("agora");
  });

  it("counts minutes under an hour", () => {
    expect(formatRelativeTime(sp("2026-09-28T20:29:00"), now)).toBe(`há 1${S}min`);
    expect(formatRelativeTime(sp("2026-09-28T19:31:00"), now)).toBe(`há 59${S}min`);
  });

  it("counts hours on the same São Paulo day", () => {
    expect(formatRelativeTime(sp("2026-09-28T19:30:00"), now)).toBe(`há 1${S}h`);
    expect(formatRelativeTime(sp("2026-09-28T00:10:00"), now)).toBe(`há 20${S}h`);
  });

  it("uses the São Paulo day, not UTC's, across midnight", () => {
    // 00:30 in São Paulo is 03:30 UTC: 21:00 the day before (00:00 UTC) is "ontem".
    const earlyMorning = sp("2026-09-29T00:30:00");
    expect(formatRelativeTime(sp("2026-09-28T21:00:00"), earlyMorning)).toBe("ontem, 21:00");
    // 23:50 São Paulo (02:50 UTC next day) vs 22:00 the same São Paulo day.
    expect(formatRelativeTime(sp("2026-09-28T22:00:00"), sp("2026-09-28T23:50:00"))).toBe(`há 1${S}h`);
  });

  it("says 'ontem' with the time for the day before", () => {
    expect(formatRelativeTime(sp("2026-09-27T18:40:00"), now)).toBe("ontem, 18:40");
    expect(formatRelativeTime(sp("2026-09-27T08:05:00"), now)).toBe("ontem, 08:05");
  });

  it("counts days within a week", () => {
    expect(formatRelativeTime(sp("2026-09-26T10:00:00"), now)).toBe(`há 2${S}dias`);
    expect(formatRelativeTime(sp("2026-09-22T10:00:00"), now)).toBe(`há 6${S}dias`);
  });

  it("prints the date after a week, with the year only when it isn't this one", () => {
    expect(formatRelativeTime(sp("2026-09-12T10:00:00"), now)).toBe(`12${S}set`);
    expect(formatRelativeTime(sp("2025-09-12T10:00:00"), now)).toBe(`12${S}set 2025`);
    expect(formatRelativeTime(sp("2026-01-01T00:00:00"), now)).toBe(`1${S}jan`);
  });

  it("accepts ISO strings", () => {
    expect(formatRelativeTime(sp("2026-09-28T20:25:00").toISOString(), now)).toBe(`há 5${S}min`);
  });
});

describe("formatFullDateTime", () => {
  it("prints the São Paulo date and time in full", () => {
    expect(formatFullDateTime(sp("2026-09-28T18:40:00"))).toBe("28 de setembro de 2026 às 18:40");
  });
});
