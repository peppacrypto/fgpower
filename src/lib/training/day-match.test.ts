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

  it("follows the day's name when the link is null (a deleted day, or an old session)", () => {
    expect(resolveSessionDay({ programDayId: null, programDayIndex: 0, name: "Terça — Inferior" }, days)?.id).toBe("d1");
  });

  it("does not credit a deleted day's session to the day now in its position (A-023)", () => {
    // Segunda (dayIndex 0) was trained then removed; days renumbered.
    const afterRemoval = [
      { id: "d1", dayIndex: 0, name: "Terça — Inferior" },
      { id: "d2", dayIndex: 1, name: "Quarta — Empurrar" },
    ];
    const orphan = { programDayId: null, programDayIndex: 0, name: "Segunda — Superior" };
    expect(resolveSessionDay(orphan, afterRemoval)).toBeUndefined();
  });

  it("a stale id (the day was deleted) does not fall back to the ordinal", () => {
    expect(resolveSessionDay({ programDayId: "gone", programDayIndex: 0, name: "Renamed" }, days)).toBeUndefined();
  });

  it("does not match when nothing lines up", () => {
    expect(resolveSessionDay({ programDayId: null, programDayIndex: 7, name: "Renamed" }, days)).toBeUndefined();
  });

  it("does not guess between two days of the same name", () => {
    const twins = [
      { id: "a", dayIndex: 0, name: "Full Body" },
      { id: "b", dayIndex: 1, name: "Full Body" },
    ];
    expect(resolveSessionDay({ programDayId: null, programDayIndex: 1, name: "Full Body" }, twins)).toBeUndefined();
  });
});
