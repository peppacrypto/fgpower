import { describe, expect, it } from "vitest";
import { deriveGroups, normalizeGroupKeys } from "./groups";

const rows = (...keys: (string | null)[]) => keys.map((groupKey, i) => ({ id: `r${i}`, groupKey }));

describe("deriveGroups", () => {
  it("letters runs of 2 and 3 in order", () => {
    const slots = deriveGroups(rows(null, "x", "x", null, "y", "y", "y"));
    expect(slots[0]).toBeNull();
    expect(slots[1]).toMatchObject({ key: "A", label: "A1", position: 1, size: 2, kind: "superset", heading: "Superset A", first: true });
    expect(slots[2]).toMatchObject({ label: "A2", last: true, firstIndex: 1, lastIndex: 2 });
    expect(slots[3]).toBeNull();
    expect(slots[4]).toMatchObject({ key: "B", label: "B1", size: 3, kind: "circuit", heading: "Circuito B" });
    expect(slots[6]).toMatchObject({ label: "B3", last: true, firstIndex: 4, lastIndex: 6 });
  });

  it("a lone key is not a group; the same key in two runs is two groups", () => {
    expect(deriveGroups(rows("A", null, "A"))).toEqual([null, null, null]);
    const slots = deriveGroups(rows("A", "A", null, "A", "A"));
    expect(slots.map((s) => s?.label ?? null)).toEqual(["A1", "A2", null, "B1", "B2"]);
  });

  it("compares keys trimmed and case-insensitive; blank is no key", () => {
    expect(deriveGroups(rows(" a", "A ")).map((s) => s?.label)).toEqual(["A1", "A2"]);
    expect(deriveGroups(rows(" ", " "))).toEqual([null, null]);
  });
});

describe("normalizeGroupKeys", () => {
  it("writes each group's letter and clears the rest", () => {
    expect(normalizeGroupKeys(rows("X", "X", null, "Y")).map((r) => r.groupKey)).toEqual(["A", "A", null, null]);
  });

  it("returns the same array when nothing changes", () => {
    const list = rows("A", "A", null, "B", "B");
    expect(normalizeGroupKeys(list)).toBe(list);
  });

  it("keeps the other fields and the unchanged items", () => {
    const list = rows(null, "q", "q");
    const out = normalizeGroupKeys(list);
    expect(out[0]).toBe(list[0]);
    expect(out[1]).toEqual({ id: "r1", groupKey: "A" });
  });
});
