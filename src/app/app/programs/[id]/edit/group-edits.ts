import {
  GROUP_TRANSITION_DEFAULT_SECONDS,
  MAX_GROUP_SIZE,
  deriveGroups,
  normalizeGroupKeys,
} from "@/lib/programming/groups";

/**
 * The builder's superset edits (W-104), pure: every result is normalized
 * (lib/programming/groups normalizeGroupKeys — each group lettered A, B… in
 * order, a lone key cleared), so the editor's state, its "unsaved" check and
 * its local draft always compare canonical data.
 */
export interface GroupRow {
  rowId: string;
  groupKey: string | null;
  restSeconds: number;
}

/** A switch longer than this is a rest, not a switch: joining a group sets it to 0:20. */
const MAX_TRANSITION_KEEP = 45;
/** Never a real letter: a new group is lettered by normalization, never merged with a neighbour's. */
const NEW_KEY = "__new__";

/** Can this row be grouped with the one below it ("Agrupar com o próximo")? */
export function canGroupWithNext(list: readonly GroupRow[], rowId: string): { ok: true } | { ok: false; reason: "last" | "grouped" | "full" } {
  const i = list.findIndex((r) => r.rowId === rowId);
  if (i < 0 || i >= list.length - 1) return { ok: false, reason: "last" };
  const slots = deriveGroups(list);
  if (slots[i]) return { ok: false, reason: "grouped" };
  const next = slots[i + 1];
  if (next && next.size >= MAX_GROUP_SIZE) return { ok: false, reason: "full" };
  return { ok: true };
}

/**
 * "Agrupar com o próximo": the row joins the group below it (it sits right
 * above that group's first member) or makes a new pair with the next row.
 * Its rest becomes the switch to the next exercise: 0:20 unless it already
 * was a short one.
 */
export function groupWithNext<T extends GroupRow>(list: T[], rowId: string): T[] {
  if (!canGroupWithNext(list, rowId).ok) return list;
  const i = list.findIndex((r) => r.rowId === rowId);
  const nextKey = list[i + 1].groupKey;
  const joining = deriveGroups(list)[i + 1] !== null;
  const key = joining && nextKey ? nextKey : NEW_KEY;
  const next = list.map((row, j) => {
    if (j === i) {
      const restSeconds = row.restSeconds > MAX_TRANSITION_KEEP ? GROUP_TRANSITION_DEFAULT_SECONDS : row.restSeconds;
      return { ...row, groupKey: key, restSeconds };
    }
    if (j === i + 1 && !joining) return { ...row, groupKey: key };
    return row;
  });
  return normalizeGroupKeys(next);
}

/**
 * "Separar do superset": a pair comes apart (both rows lose the key); a row
 * leaving a circuit of 3+ moves to just after it, so the others stay
 * together and in order.
 */
export function separateFromGroup<T extends GroupRow>(list: T[], rowId: string): T[] {
  const i = list.findIndex((r) => r.rowId === rowId);
  const slot = i >= 0 ? deriveGroups(list)[i] : null;
  if (!slot) return list;
  if (slot.size <= 2) return dissolveGroup(list, rowId);
  const row = { ...list[i], groupKey: null };
  const rest = list.filter((_, j) => j !== i);
  // The group's last member is now one place up when the row sat above it.
  const at = slot.lastIndex; // after removal, inserting at lastIndex puts it right after the group
  return normalizeGroupKeys([...rest.slice(0, at), row, ...rest.slice(at)]);
}

/** "Desagrupar": every member of the row's group loses the key, in place. */
export function dissolveGroup<T extends GroupRow>(list: T[], rowId: string): T[] {
  const i = list.findIndex((r) => r.rowId === rowId);
  const slot = i >= 0 ? deriveGroups(list)[i] : null;
  if (!slot) return list;
  return normalizeGroupKeys(list.map((row, j) => (j >= slot.firstIndex && j <= slot.lastIndex ? { ...row, groupKey: null } : row)));
}

/**
 * A superset edit's "Desfazer": the keys, the rests and the order as they
 * were `before`. When rows came or went since (a "Duplicar" within the undo
 * window), the keys and rests still go back on the rows that are there, in
 * the order they now stand — a Desfazer never does nothing.
 */
export function restoreGroupEdit<T extends GroupRow>(list: T[], before: readonly GroupRow[]): T[] {
  const byId = new Map(list.map((row) => [row.rowId, row]));
  if (before.length === list.length && before.every((b) => byId.has(b.rowId))) {
    return normalizeGroupKeys(before.map((b) => ({ ...byId.get(b.rowId)!, groupKey: b.groupKey, restSeconds: b.restSeconds })));
  }
  const was = new Map(before.map((b) => [b.rowId, b]));
  return normalizeGroupKeys(
    list.map((row) => {
      const b = was.get(row.rowId);
      return b ? { ...row, groupKey: b.groupKey, restSeconds: b.restSeconds } : row;
    }),
  );
}

/**
 * Where "Duplicar" puts the copy of the row at `index`: right after it — or,
 * for a group's member, right after the group (the copy isn't grouped).
 */
export function duplicateAt(list: readonly GroupRow[], index: number): number {
  const slot = deriveGroups(list)[index];
  return (slot ? slot.lastIndex : index) + 1;
}
