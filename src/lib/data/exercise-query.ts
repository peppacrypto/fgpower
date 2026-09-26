import { normalizeText } from "@/lib/utils/normalize-text";

/**
 * Turns a free-text exercise search into AND-ed word groups. People search
 * the way they talk — "supino halter", "puxada neutra", "halteres supino" —
 * while names put those words apart or in another order, so every word must
 * match somewhere in the name, not the phrase as a whole.
 *
 * Each group lists the substrings that satisfy one word (any of them). Light
 * pt-BR plural stemming makes "halteres" find "halter", "flexões" find
 * "flexão" and "laterais" find "lateral"; the singular already matches the
 * plural as a substring.
 */

// Connectives that add nothing to a name match (and, being short, would
// match inside almost any word).
const STOP_WORDS = new Set([
  "a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "com", "sem", "na", "no", "nas", "nos",
  "em", "para", "pra", "por", "um", "uma", "the", "with", "of", "on", "and",
]);

/**
 * Bounds on what one search can ask of the DB (the library is public, signed
 * out): characters read from the query, and AND-ed word groups kept. Real
 * exercise searches are two or three words.
 */
const MAX_QUERY_LENGTH = 100;
const MAX_WORDS = 6;

/** Minimum word length before plural stemming kicks in ("pes", "abs" stay as typed). */
const MIN_STEM_LENGTH = 4;

function variants(word: string): string[] {
  if (word.length < MIN_STEM_LENGTH) return [word];
  // -ões / -ães ⇄ -ão (flexões / flexão, elevações / elevação)
  if (/(oes|aes)$/.test(word)) return [word, `${word.slice(0, -3)}ao`];
  if (word.endsWith("ao")) return [word, `${word.slice(0, -2)}oes`, `${word.slice(0, -2)}aes`];
  // -ais / -éis / -óis ⇄ -al / -el / -ol (laterais / lateral)
  const ais = word.match(/^(.+)(a|e|o)is$/);
  if (ais) return [word, `${ais[1]}${ais[2]}l`];
  const al = word.match(/^(.+)(a|e|o)l$/);
  if (al) return [word, `${al[1]}${al[2]}is`];
  // -res / -ses / -zes → drop "es" (halteres → halter, adutores → adutor)
  if (/[rsz]es$/.test(word)) return [word.slice(0, -2)];
  // plain -s → drop it (barras → barra, cabos → cabo); the stem still matches the plural
  if (word.endsWith("s") && !word.endsWith("ss")) return [word.slice(0, -1)];
  return [word];
}

/** Word groups for `q`, or [] when there is nothing to search for. */
export function exerciseSearchTerms(q: string): string[][] {
  const words = normalizeText(q.slice(0, MAX_QUERY_LENGTH))
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  // A query made only of connectives ("de") still searches for itself.
  const chosen = meaningful.length > 0 ? meaningful : words;
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const word of chosen) {
    if (seen.has(word)) continue;
    seen.add(word);
    groups.push(variants(word));
    if (groups.length === MAX_WORDS) break;
  }
  return groups;
}

/**
 * Prisma `where` fragment matching every word group against `searchText`.
 * A blank query filters nothing; one with no searchable word ("%%", "-")
 * matches nothing rather than the whole catalog.
 */
export function exerciseSearchWhere(q: string) {
  const groups = exerciseSearchTerms(q);
  if (groups.length === 0) return q.trim() ? { id: { in: [] as string[] } } : {};
  return {
    AND: groups.map((alts) =>
      alts.length === 1
        ? { searchText: { contains: alts[0] } }
        : { OR: alts.map((alt) => ({ searchText: { contains: alt } })) },
    ),
  };
}
