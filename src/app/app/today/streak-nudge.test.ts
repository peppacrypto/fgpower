import { describe, expect, it } from "vitest";
import { nudgeDaysLeft, nudgeFits } from "./streak-nudge";

// São Paulo is UTC−3: 15:00Z is midday there.
const at = (iso: string) => new Date(`${iso}T15:00:00Z`);

describe("the streak's 'faltam N' line (W-131: no cramming)", () => {
  it("shows a count the days left can hold at the plan's spacing, 2 at most", () => {
    // 3×/week, Thursday (4 days left), 1 of 3 done: Thursday and Saturday.
    expect(nudgeFits(2, 4, 3)).toBe(true);
    // Sunday, one left.
    expect(nudgeFits(1, 1, 3)).toBe(true);
    // 5×/week, Thursday, 3 of 5 done.
    expect(nudgeFits(2, 4, 5)).toBe(true);
  });

  it("stays quiet when it would take back-to-back sessions or more than 2", () => {
    // 5×/week, Thursday, 1 of 5 done: "faltam 4" is four days in a row.
    expect(nudgeFits(4, 4, 5)).toBe(false);
    // 3× full body, Friday, 0 of 3: three sessions in three days.
    expect(nudgeFits(3, 3, 3)).toBe(false);
    // 3×/week, Saturday, 2 left: Saturday and Sunday back to back.
    expect(nudgeFits(2, 2, 3)).toBe(false);
    expect(nudgeFits(0, 4, 3)).toBe(false);
  });

  it("a day already trained isn't a day left: a trained Sunday can't be asked for 'falta 1'", () => {
    expect(nudgeDaysLeft(at("2026-09-27"), false)).toBe(1);
    expect(nudgeDaysLeft(at("2026-09-27"), true)).toBe(0);
    expect(nudgeFits(1, nudgeDaysLeft(at("2026-09-27"), true), 5)).toBe(false);
    // Saturday, trained: Sunday is still there.
    expect(nudgeDaysLeft(at("2026-09-26"), true)).toBe(1);
    expect(nudgeFits(1, nudgeDaysLeft(at("2026-09-26"), true), 5)).toBe(true);
  });
});
