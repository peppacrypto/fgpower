import { describe, expect, it } from "vitest";
import { resolveSessionDay } from "./day-match";

const days = [
  { id: "d0", dayIndex: 0, name: "Segunda — Superior" },
  { id: "d1", dayIndex: 1, name: "Terça — Inferior" },
  { id: "d2", dayIndex: 2, name: "Quarta — Empurrar" },
];

describe("resolveSessionDay", () => {
  it("uses the day id when it still exists", () => {
    expect(resolveSessionDay({ programDayId: "d1", programDayIndex: 0, name: "x" }, days)?.id).toBe("d1");
  });

  it("follows the day's name after a program edit recreated the days", () => {
    expect(resolveSessionDay({ programDayId: null, programDayIndex: 0, name: "Terça — Inferior" }, days)?.id).toBe("d1");
  });

  it("falls back to the position when the name is gone", () => {
    expect(resolveSessionDay({ programDayId: null, programDayIndex: 2, name: "Renamed" }, days)?.id).toBe("d2");
  });

  it("does not match when nothing lines up", () => {
    expect(resolveSessionDay({ programDayId: null, programDayIndex: 7, name: "Renamed" }, days)).toBeUndefined();
  });
});
