/**
 * The one definition of a superset / circuit (W-104): a run of 2+ consecutive
 * exercises with the same groupKey, lettered A, B, C… in list order (per day
 * or per workout). A key on a single row groups nothing; the same key in two
 * separate runs makes two groups. Keys compare trimmed and case-insensitive.
 * Used by the builder and its save, the workout screen, the summary, the
 * program page and dossier, share cards and the export — never read groupKey
 * directly. Pure.
 */

export const MAX_GROUP_SIZE = 4;
/** The switch between two exercises of a group (the first member's rest). */
export const GROUP_TRANSITION_DEFAULT_SECONDS = 20;
export const TRANSITION_PRESETS = [0, 15, 20, 30, 45] as const;

export interface GroupSlot {
  /** The group's letter: "A", "B"… */
  key: string;
  /** 1-based position in the group. */
  position: number;
  size: number;
  kind: "superset" | "circuit";
  /** "A1", "A2"… */
  label: string;
  /** "Superset A" (2 exercises) / "Circuito A" (3+). */
  heading: string;
  first: boolean;
  last: boolean;
  /** Indexes (in the list given) of the group's first and last member. */
  firstIndex: number;
  lastIndex: number;
}

function keyOf(item: { groupKey: string | null | undefined }): string | null {
  const key = item.groupKey?.trim().toUpperCase();
  return key ? key : null;
}

/** Each item's place in its group, or null when it isn't in one. */
export function deriveGroups(items: readonly { groupKey: string | null | undefined }[]): (GroupSlot | null)[] {
  const out: (GroupSlot | null)[] = items.map(() => null);
  let letter = 0;
  let i = 0;
  while (i < items.length) {
    const key = keyOf(items[i]);
    let end = i + 1;
    if (key !== null) while (end < items.length && keyOf(items[end]) === key) end++;
    const size = end - i;
    if (key !== null && size >= 2) {
      const name = String.fromCharCode(65 + letter++);
      const kind = size === 2 ? "superset" : "circuit";
      for (let j = i; j < end; j++) {
        const position = j - i + 1;
        out[j] = {
          key: name,
          position,
          size,
          kind,
          label: `${name}${position}`,
          heading: `${kind === "superset" ? "Superset" : "Circuito"} ${name}`,
          first: j === i,
          last: j === end - 1,
          firstIndex: i,
          lastIndex: end - 1,
        };
      }
    }
    i = end;
  }
  return out;
}

/**
 * The line over a group's first member, as every surface prints it (W-104):
 * "Superset A · alterne as séries", "Circuito B · uma série de cada, em
 * ordem". Shown in mono micro-caps (uppercase by CSS).
 */
export function groupRule(group: Pick<GroupSlot, "heading" | "kind">): string {
  return `${group.heading} · ${group.kind === "superset" ? "alterne as séries" : "uma série de cada, em ordem"}`;
}

/**
 * The canonical keys: each group's letter, null for everything else (a lone
 * key, a blank one). Returns the same array when nothing changes, so state
 * comparisons stay cheap.
 */
export function normalizeGroupKeys<T extends { groupKey: string | null }>(items: T[]): T[] {
  const slots = deriveGroups(items);
  let changed = false;
  const next = items.map((item, i) => {
    const key = slots[i]?.key ?? null;
    if (item.groupKey === key) return item;
    changed = true;
    return { ...item, groupKey: key };
  });
  return changed ? next : items;
}
