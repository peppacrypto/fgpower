import type { Prisma } from "@/generated/prisma/client";
import { MUSCLE_GROUP_LABEL, type MuscleGroupTag } from "@/lib/constants/muscle-groups";
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

/** A text's normalized words: "Supino Reto (Barra)" → ["supino", "reto", "barra"]. */
export function searchWords(text: string): string[] {
  return normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Word groups for `q`, or [] when there is nothing to search for. */
export function exerciseSearchTerms(q: string): string[][] {
  const words = searchWords(q.slice(0, MAX_QUERY_LENGTH));
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

// ---------------------------------------------------------------------------
// Muscles. "glúteo", "peito", "costas", "posterior de coxa" are how people
// look for exercises, and most names never say the muscle ("Hip Thrust com
// Barra", "Supino Reto"). A word that names a primary muscle — its pt/en name,
// its group's label or a gym synonym — matches the exercises working it.
// ---------------------------------------------------------------------------

export interface MuscleForSearch {
  id: string;
  namePt: string;
  nameEn: string;
  group: string;
}

/** Gym-floor pt-BR words for a muscle (Muscle.id) that its name doesn't carry. */
const MUSCLE_SYNONYMS: Record<string, string> = {
  chest: "peito",
  lats: "dorsal dorsais",
  "middle-back": "dorsal",
  "spinal-erectors": "lombar lombares",
  shoulders: "ombro deltoide",
  "anterior-deltoid": "ombro",
  "lateral-deltoid": "ombro",
  "posterior-deltoid": "ombro",
  forearms: "antebraco",
  quadriceps: "coxa",
  hamstrings: "posterior posteriores coxa",
  calves: "panturrilha",
  glutes: "gluteo bumbum",
  abdominals: "abdominal abdominais barriga",
  obliques: "obliquo",
};

function muscleWords(m: MuscleForSearch): string[] {
  const group = MUSCLE_GROUP_LABEL[m.group as MuscleGroupTag];
  return searchWords(`${m.namePt} ${m.nameEn} ${group?.pt ?? ""} ${group?.en ?? ""} ${MUSCLE_SYNONYMS[m.id] ?? ""}`);
}

/** Muscles one word group names: some word of the muscle starts with one of its forms ("glute" → Glúteos). */
export function matchingMuscleIds(alts: string[], muscles: MuscleForSearch[]): string[] {
  return muscles.filter((m) => muscleWords(m).some((w) => alts.some((alt) => w.startsWith(alt)))).map((m) => m.id);
}

/**
 * Prisma `where` fragment: every word group must match the exercise's
 * searchText (names + aliases, normalized), one of its aliases, or one of its
 * primary muscles; a word asking for stretching work ("mobilidade",
 * "aquecimento") also matches every stretch, since few say so in the name. A
 * blank query filters nothing; one with no searchable word ("%%", "-")
 * matches nothing rather than the whole catalog.
 */
export function exerciseSearchWhere(q: string, muscles: MuscleForSearch[] = []): Prisma.ExerciseWhereInput {
  const groups = exerciseSearchTerms(q);
  if (groups.length === 0) return q.trim() ? { id: { in: [] as string[] } } : {};
  return {
    AND: groups.map((alts) => {
      const muscleIds = matchingMuscleIds(alts, muscles);
      return {
        OR: [
          ...alts.map((alt) => ({ searchText: { contains: alt } })),
          ...alts.map((alt) => ({ aliases: { some: { alias: { contains: alt, mode: "insensitive" as const } } } })),
          ...(muscleIds.length > 0
            ? [{ muscles: { some: { role: "PRIMARY" as const, muscleId: { in: muscleIds } } } }]
            : []),
          ...(isStretchWord(alts) ? [{ category: "STRETCHING" as const }] : []),
        ],
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Stretches. 123 of the catalog's exercises are stretches and mobility drills
// ("Alongamento de Glúteo…"); they flooded muscle searches ahead of the lifts.
// They stay out of the library unless the search asks for them.
// ---------------------------------------------------------------------------

const STRETCH_WORD_STARTS = ["along", "stretch", "mobilid", "mobility", "liberac", "miofasc", "smr", "flexibil", "aquec"];

/** Whether one word (any of its forms) asks for stretching work: "mobilidade", "alongamentos". */
export function isStretchWord(alts: string[]): boolean {
  return alts.some((w) => STRETCH_WORD_STARTS.some((s) => w.startsWith(s)));
}

/** Whether the search asks for stretches / mobility work ("alongamento", "mobilidade de quadril"). */
export function asksForStretching(q: string): boolean {
  return searchWords(q.slice(0, MAX_QUERY_LENGTH)).some((w) => isStretchWord([w]));
}

// ---------------------------------------------------------------------------
// Ranking. A name that starts with what was typed beats one that has the
// words whole, which beats one that merely contains them, which beats a match
// through a muscle only; inside each tier the most used exercise comes first.
// ---------------------------------------------------------------------------

export const MATCH_TIER = {
  /** A name starts with the query as typed ("supino re" → "Supino Reto com Barra"). */
  PHRASE_START: 0,
  /** A name's first word starts with the query's first word ("supino halter" → "Supino com Halteres"). */
  FIRST_WORD: 1,
  /**
   * One name has every word whole ("martelo rosca" → "Rosca Martelo") — a
   * word naming one of the exercise's primary muscles counts as there: for
   * "peito", "Supino Reto" sits with "Arremesso de Peito" and the most used wins.
   */
  WHOLE_WORDS: 2,
  /** One name has a word starting with each ("rosc mart"). */
  WORD_STARTS: 3,
  /** The names contain every word somewhere. */
  CONTAINS: 4,
  /** Matched through other indexed text only. */
  OTHER: 5,
} as const;

export interface RankCandidate {
  id: string;
  namePt: string;
  nameEn: string;
  aliases: string[];
  popularity: number;
  isCurated: boolean;
  /** Primary muscles (Muscle.id), for words that name a muscle. */
  muscleIds?: string[];
}

const isWord = (word: string, alts: string[]) =>
  alts.some((alt) => word === alt || variants(word).includes(alt));
const startsWord = (word: string, alts: string[]) => alts.some((alt) => word.startsWith(alt));

/**
 * How well `names` (pt name, en name, aliases) answer the query — lower is
 * better. `muscleHits[i]`: word group i names one of the exercise's primary
 * muscles, which then counts as a whole word of any name.
 */
export function matchTier(q: string, names: string[], muscleHits: boolean[] = []): number {
  const groups = exerciseSearchTerms(q);
  if (groups.length === 0) return MATCH_TIER.OTHER;
  const phrase = searchWords(q.slice(0, MAX_QUERY_LENGTH)).join(" ");
  const named = names.map(searchWords).filter((words) => words.length > 0);
  if (named.some((words) => words.join(" ").startsWith(phrase))) return MATCH_TIER.PHRASE_START;
  if (named.some((words) => startsWord(words[0], groups[0]))) return MATCH_TIER.FIRST_WORD;
  const hit = (i: number) => muscleHits[i] === true;
  if (named.some((words) => groups.every((alts, i) => hit(i) || words.some((w) => isWord(w, alts))))) return MATCH_TIER.WHOLE_WORDS;
  if (named.some((words) => groups.every((alts, i) => hit(i) || words.some((w) => startsWord(w, alts))))) return MATCH_TIER.WORD_STARTS;
  const all = named.map((words) => words.join(" ")).join(" | ");
  if (groups.every((alts, i) => hit(i) || alts.some((alt) => all.includes(alt)))) return MATCH_TIER.CONTAINS;
  return MATCH_TIER.OTHER;
}

const byName = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Where a candidate sorts for `q`: its tier, and whether it got there only
 * through an alias. The exercise's own name wins a tie with a nickname — for
 * "flexão" the push-ups ("Flexão de Braço…") come before "Mesa Flexora", whose
 * alias "flexão de joelhos" also starts with the word — except when the query
 * *is* the alias ("push-up", "apoio"): that is the exercise asked for.
 */
export function rankKey(
  q: string,
  c: RankCandidate,
  /** Per word group, the muscles it names (matchingMuscleIds). */
  muscleGroups: string[][] = [],
): { tier: number; viaAlias: 0 | 1 } {
  const phrase = searchWords(q.slice(0, MAX_QUERY_LENGTH)).join(" ");
  if (phrase && c.aliases.some((a) => searchWords(a).join(" ") === phrase)) return { tier: MATCH_TIER.PHRASE_START, viaAlias: 0 };
  const muscleHits = muscleGroups.map((ids) => ids.some((id) => c.muscleIds?.includes(id) ?? false));
  const nameTier = matchTier(q, [c.namePt, c.nameEn], muscleHits);
  const aliasTier = c.aliases.length > 0 ? matchTier(q, c.aliases) : MATCH_TIER.OTHER;
  return nameTier <= aliasTier ? { tier: nameTier, viaAlias: 0 } : { tier: aliasTier, viaAlias: 1 };
}

/**
 * The matches for `q` in library order: tier (a name before a nickname at the
 * same tier), then popularity (template usage), curated content, pt name and
 * id — a total order, so a page never shuffles between requests.
 */
export function rankExercises<T extends RankCandidate>(q: string, candidates: T[], muscles: MuscleForSearch[] = []): T[] {
  const muscleGroups = exerciseSearchTerms(q).map((alts) => matchingMuscleIds(alts, muscles));
  const keys = new Map(candidates.map((c) => [c.id, rankKey(q, c, muscleGroups)]));
  const other = { tier: MATCH_TIER.OTHER, viaAlias: 1 };
  return [...candidates].sort((a, b) => {
    const ka = keys.get(a.id) ?? other;
    const kb = keys.get(b.id) ?? other;
    return (
      ka.tier - kb.tier ||
      ka.viaAlias - kb.viaAlias ||
      b.popularity - a.popularity ||
      Number(b.isCurated) - Number(a.isCurated) ||
      byName.compare(a.namePt, b.namePt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  });
}
