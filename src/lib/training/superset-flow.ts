/**
 * How a superset / circuit runs on the workout screen (W-104): after each
 * working set of a member, where to go next and how long to rest. One set of
 * each member in turn — A1, A2, A1, A2… — with the short switch between them
 * (the member's own rest: 0:20 in the GD blocks) and the round's rest (the
 * last member's: 2:00) after the round. Members run out unevenly (GD 2 sets
 * vs 4): the leftover sets go solo, each followed by the round's rest, never
 * the 20 s switch. A skipped member, one replaced by a stand-in ("Adicionar
 * como novo exercício") and one with no working set left drop out of the
 * rotation. Pure; everything flows from the screen's own drafts, offline too.
 */

export interface FlowMember {
  /** The exercise's index in the workout. */
  index: number;
  /** Its own rest: the switch to the next member (the last member's is the round's rest). */
  restSeconds: number;
  /** Prescribed working sets not done yet (with the ✓ just tapped applied). */
  openWorking: number;
  /** Skipped or replaced: out of the rotation whatever its sets say. */
  out?: boolean;
}

export interface FlowStep {
  /** The rest to run now; 0 starts no timer. */
  restSeconds: number;
  /** "transition": the switch to the next member; "round": the rest after a round (or a solo leftover set). */
  kind: "transition" | "round";
  /** The exercise to show next; null when the group is done. */
  nextIndex: number | null;
  /** Every member has nothing left: the screen moves past the group. */
  groupDone: boolean;
}

const exhausted = (m: FlowMember) => m.out === true || m.openWorking <= 0;

/**
 * The step after a working set of member `doneIndex` (an exercise index) was
 * ✓'d. `members` are the group's members in order.
 */
export function afterWorkingSet(members: readonly FlowMember[], doneIndex: number): FlowStep {
  const at = members.findIndex((m) => m.index === doneIndex);
  const done = members[at];
  const roundRest = members[members.length - 1]?.restSeconds ?? 0;
  if (!done) return { restSeconds: 0, kind: "round", nextIndex: null, groupDone: true };
  const later = members.slice(at + 1).find((m) => !exhausted(m));
  if (later) return { restSeconds: done.restSeconds, kind: "transition", nextIndex: later.index, groupDone: false };
  const first = members.find((m) => !exhausted(m));
  return { restSeconds: roundRest, kind: "round", nextIndex: first?.index ?? null, groupDone: !first };
}

/**
 * Which member to open on when the screen lands on the group (a reload, the
 * first unfinished exercise): the one whose turn it is — the member still in
 * the rotation with the fewest working sets done (the earliest on a tie).
 * Null when none is left.
 */
export function memberOnTurn(members: readonly (FlowMember & { doneWorking: number })[]): number | null {
  let best: (FlowMember & { doneWorking: number }) | null = null;
  for (const m of members) {
    if (exhausted(m)) continue;
    if (!best || m.doneWorking < best.doneWorking) best = m;
  }
  return best?.index ?? null;
}
