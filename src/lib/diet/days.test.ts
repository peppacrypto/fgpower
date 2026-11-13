import { describe, expect, it } from "vitest";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { DIET_BACKDATE_DAYS, dayOfIso, dietDateText, dietDayName, isMarkableDay, isoOfDay, parseDietDay } from "./days";

const DAY_MS = 86_400_000;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

describe("Dieta's days", () => {
  it("reads 'YYYY-MM-DD' as its day number (BodyMetric's numbering), real dates only", () => {
    expect(dayOfIso("2026-11-13")).toBe(day("2026-11-13"));
    expect(isoOfDay(day("2026-11-13"))).toBe("2026-11-13");
    for (const bad of ["2026-02-30", "2026-13-01", "13/11/2026", "2026-11-13T00:00", "", null, 20261113]) {
      expect(dayOfIso(bad), String(bad)).toBeNull();
    }
    // 23:30 in São Paulo on the 13th is 02:30 UTC on the 14th: still the 13th.
    expect(dayNumberOf(new Date("2026-11-14T02:30:00Z"))).toBe(dayOfIso("2026-11-13"));
  });

  it("shows today, or an earlier day up to a year back — never a later one", () => {
    const today = day("2026-11-13");
    expect(parseDietDay(undefined, today)).toBe(today);
    expect(parseDietDay("2026-11-12", today)).toBe(today - 1);
    expect(parseDietDay("2026-11-14", today)).toBe(today);
    expect(parseDietDay(["2026-11-12", "2026-11-11"], today)).toBe(today);
    expect(parseDietDay("ontem", today)).toBe(today);
    expect(isMarkableDay(today - DIET_BACKDATE_DAYS, today)).toBe(true);
    expect(isMarkableDay(today - DIET_BACKDATE_DAYS - 1, today)).toBe(false);
    expect(isMarkableDay(today + 1, today)).toBe(false);
    expect(parseDietDay(isoOfDay(today - DIET_BACKDATE_DAYS - 1), today)).toBe(today);
  });

  it("names the day: Hoje, Ontem, then the date (with the year when it isn't this one)", () => {
    const today = day("2026-11-13");
    expect(dietDayName(today, today)).toBe("Hoje");
    expect(dietDayName(today - 1, today)).toBe("Ontem");
    expect(dietDayName(today - 2, today)).toBeNull();
    expect(dietDateText(today, today)).toBe("sexta, 13 nov");
    expect(dietDateText(day("2025-12-30"), today)).toBe("terça, 30 dez 2025");
  });
});
