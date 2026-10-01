import { describe, expect, it } from "vitest";
import {
  canGroupWithNext,
  dissolveGroup,
  duplicateAt,
  groupWithNext,
  restoreGroupEdit,
  separateFromGroup,
  type GroupRow,
} from "./group-edits";

const rows = (...spec: [string, string | null, number?][]): GroupRow[] =>
  spec.map(([rowId, groupKey, restSeconds = 90]) => ({ rowId, groupKey, restSeconds }));
const keys = (list: GroupRow[]) => list.map((r) => `${r.rowId}:${r.groupKey ?? "-"}`).join(" ");

describe("groupWithNext", () => {
  it("pairs a row with the next one, lettered in order, and makes its rest the 0:20 switch", () => {
    const out = groupWithNext(rows(["a", null, 120], ["b", null, 120], ["c", null]), "a");
    expect(keys(out)).toBe("a:A b:A c:-");
    expect(out[0].restSeconds).toBe(20);
    expect(out[1].restSeconds).toBe(120);
  });

  it("keeps a switch that was already short", () => {
    expect(groupWithNext(rows(["a", null, 30], ["b", null]), "a")[0].restSeconds).toBe(30);
    expect(groupWithNext(rows(["a", null, 45], ["b", null]), "a")[0].restSeconds).toBe(45);
  });

  it("joins the group right below, never merging with a group above", () => {
    const out = groupWithNext(rows(["a", "A"], ["b", "A"], ["c", null], ["d", "B"], ["e", "B"]), "c");
    expect(keys(out)).toBe("a:A b:A c:B d:B e:B");
    // A new pair between two groups gets its own letter.
    const pair = groupWithNext(rows(["a", "A"], ["b", "A"], ["c", null], ["d", null], ["e", "B"], ["f", "B"]), "c");
    expect(keys(pair)).toBe("a:A b:A c:B d:B e:C f:C");
  });

  it("stops at 4 members, and never from a grouped row or the last one", () => {
    const full = rows(["a", null], ["b", "A"], ["c", "A"], ["d", "A"], ["e", "A"]);
    expect(canGroupWithNext(full, "a")).toEqual({ ok: false, reason: "full" });
    expect(groupWithNext(full, "a")).toBe(full);
    expect(canGroupWithNext(full, "b")).toEqual({ ok: false, reason: "grouped" });
    expect(canGroupWithNext(rows(["a", null], ["b", null]), "b")).toEqual({ ok: false, reason: "last" });
  });
});

describe("separateFromGroup", () => {
  it("takes a pair apart", () => {
    expect(keys(separateFromGroup(rows(["a", "A"], ["b", "A"], ["c", null]), "b"))).toBe("a:- b:- c:-");
  });

  it("moves a row leaving a circuit to just after it; the rest stay together", () => {
    const circuit = rows(["x", null], ["a", "A"], ["b", "A"], ["c", "A"], ["y", null]);
    expect(keys(separateFromGroup(circuit, "a"))).toBe("x:- b:A c:A a:- y:-");
    expect(keys(separateFromGroup(circuit, "b"))).toBe("x:- a:A c:A b:- y:-");
    expect(keys(separateFromGroup(circuit, "c"))).toBe("x:- a:A b:A c:- y:-");
  });

  it("leaves an ungrouped row alone", () => {
    const list = rows(["a", null], ["b", null]);
    expect(separateFromGroup(list, "a")).toBe(list);
  });
});

describe("dissolveGroup", () => {
  it("clears the whole group in place, and only it", () => {
    expect(keys(dissolveGroup(rows(["a", "A"], ["b", "A"], ["c", "A"], ["d", "B"], ["e", "B"]), "b"))).toBe("a:- b:- c:- d:A e:A");
  });
});

describe("duplicateAt", () => {
  it("puts a copy after the row, or after its group", () => {
    const list = rows(["a", null], ["b", "A"], ["c", "A"], ["d", null]);
    expect(duplicateAt(list, 0)).toBe(1);
    expect(duplicateAt(list, 1)).toBe(3);
    expect(duplicateAt(list, 2)).toBe(3);
    expect(duplicateAt(list, 3)).toBe(4);
  });
});

describe("restoreGroupEdit (Desfazer)", () => {
  it("puts back the keys, the rests and the order", () => {
    const before = rows(["a", null, 120], ["b", "A"], ["c", "A"], ["d", "A"], ["e", null]);
    const grouped = groupWithNext(before, "a");
    expect(restoreGroupEdit(grouped, before)).toEqual(before);
    const separated = separateFromGroup(before, "b");
    expect(keys(separated)).toBe("a:- c:A d:A b:- e:-");
    expect(restoreGroupEdit(separated, before)).toEqual(before);
  });

  it("still undoes after a row was duplicated meanwhile: the copy stays, the group comes apart", () => {
    const before = rows(["a", null, 120], ["b", null, 120], ["c", null]);
    const grouped = groupWithNext(before, "a");
    // "Duplicar" on the pair's second member puts an ungrouped copy right after the group.
    const withCopy = [...grouped.slice(0, 2), { rowId: "b2", groupKey: null, restSeconds: 120 }, ...grouped.slice(2)];
    const undone = restoreGroupEdit(withCopy, before);
    expect(keys(undone)).toBe("a:- b:- b2:- c:-");
    expect(undone[0].restSeconds).toBe(120);
  });

  it("puts back a group a removed row had left", () => {
    const before = rows(["a", "A"], ["b", "A"], ["c", "A"], ["d", null]);
    const dissolved = dissolveGroup(before, "a").filter((r) => r.rowId !== "d");
    expect(keys(restoreGroupEdit(dissolved, before))).toBe("a:A b:A c:A");
  });
});
