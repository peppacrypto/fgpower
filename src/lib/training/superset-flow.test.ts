import { describe, expect, it } from "vitest";
import { afterWorkingSet, memberOnTurn, type FlowMember } from "./superset-flow";

/** A pair at exercise indexes 3 and 4: A1 switches in 20 s, the round rests 120 s. */
const pair = (open1: number, open2: number, extra: Partial<Record<0 | 1, Partial<FlowMember>>> = {}): FlowMember[] => [
  { index: 3, restSeconds: 20, openWorking: open1, ...extra[0] },
  { index: 4, restSeconds: 120, openWorking: open2, ...extra[1] },
];

describe("afterWorkingSet", () => {
  it("alternates an even pair: 20 s to A2, then 120 s back to A1", () => {
    // 3/3 sets: A1 set 1 done (2 left), A2 untouched.
    expect(afterWorkingSet(pair(2, 3), 3)).toEqual({ restSeconds: 20, kind: "transition", nextIndex: 4, groupDone: false });
    // A2 set 1 done.
    expect(afterWorkingSet(pair(2, 2), 4)).toEqual({ restSeconds: 120, kind: "round", nextIndex: 3, groupDone: false });
  });

  it("the last round ends the group", () => {
    expect(afterWorkingSet(pair(0, 1), 3)).toMatchObject({ kind: "transition", nextIndex: 4 });
    expect(afterWorkingSet(pair(0, 0), 4)).toEqual({ restSeconds: 120, kind: "round", nextIndex: null, groupDone: true });
  });

  it("GD 2/4: once A1 runs out, A2 goes solo with the round's rest", () => {
    // A1's last set just done: A2 still has 3.
    expect(afterWorkingSet(pair(0, 3), 3)).toEqual({ restSeconds: 20, kind: "transition", nextIndex: 4, groupDone: false });
    // A2's sets now go solo, 120 s each, staying on A2.
    expect(afterWorkingSet(pair(0, 2), 4)).toEqual({ restSeconds: 120, kind: "round", nextIndex: 4, groupDone: false });
  });

  it("A1 4 / A2 2: A1's leftover sets get 120 s, never the 20 s switch", () => {
    expect(afterWorkingSet(pair(1, 0), 3)).toEqual({ restSeconds: 120, kind: "round", nextIndex: 3, groupDone: false });
  });

  it("a skipped or replaced member drops out of the rotation", () => {
    expect(afterWorkingSet(pair(2, 3, { 1: { out: true } }), 3)).toEqual({
      restSeconds: 120,
      kind: "round",
      nextIndex: 3,
      groupDone: false,
    });
    expect(afterWorkingSet(pair(3, 2, { 0: { out: true } }), 4)).toMatchObject({ kind: "round", nextIndex: 4 });
  });

  it("runs a 3-member circuit in order, the round's rest after the last", () => {
    const circuit: FlowMember[] = [
      { index: 0, restSeconds: 15, openWorking: 2 },
      { index: 1, restSeconds: 30, openWorking: 3 },
      { index: 2, restSeconds: 90, openWorking: 3 },
    ];
    expect(afterWorkingSet(circuit, 0)).toMatchObject({ restSeconds: 15, kind: "transition", nextIndex: 1 });
    expect(afterWorkingSet(circuit, 1)).toMatchObject({ restSeconds: 30, kind: "transition", nextIndex: 2 });
    expect(afterWorkingSet(circuit, 2)).toMatchObject({ restSeconds: 90, kind: "round", nextIndex: 0 });
    // The middle one out: 0 switches straight to 2.
    expect(afterWorkingSet([circuit[0], { ...circuit[1], openWorking: 0 }, circuit[2]], 0)).toMatchObject({ nextIndex: 2 });
  });

  it("a 0 s switch is a transition with no rest to run", () => {
    expect(afterWorkingSet(pair(2, 3, { 0: { restSeconds: 0 } }), 3)).toEqual({
      restSeconds: 0,
      kind: "transition",
      nextIndex: 4,
      groupDone: false,
    });
  });

  it("an index outside the group changes nothing", () => {
    expect(afterWorkingSet(pair(2, 2), 9)).toEqual({ restSeconds: 0, kind: "round", nextIndex: null, groupDone: true });
  });
});

describe("memberOnTurn", () => {
  it("opens on the member with the fewest sets done, the earliest on a tie", () => {
    expect(memberOnTurn([{ ...pair(3, 3)[0], doneWorking: 0 }, { ...pair(3, 3)[1], doneWorking: 0 }])).toBe(3);
    expect(memberOnTurn([{ ...pair(2, 3)[0], doneWorking: 1 }, { ...pair(2, 3)[1], doneWorking: 0 }])).toBe(4);
    expect(memberOnTurn([{ ...pair(0, 2)[0], doneWorking: 2 }, { ...pair(0, 2)[1], doneWorking: 2 }])).toBe(4);
    expect(memberOnTurn([{ ...pair(0, 0)[0], doneWorking: 3 }, { ...pair(0, 0)[1], doneWorking: 3 }])).toBeNull();
  });
});
