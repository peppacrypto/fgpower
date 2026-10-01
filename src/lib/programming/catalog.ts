/**
 * The program library's pure logic: how templates are grouped, the chip
 * facets (days · level · place · goal) and the search that understands how
 * Brazilians actually look for a program ("emagrecer", "em casa", "treino
 * ABC", "30 min"). No I/O — shared by the app library, the public library and
 * their tests.
 */
import {
  EQUIPMENT_LABEL,
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  STYLE_ALIASES,
  STYLE_LABEL,
} from "@/lib/constants/program-labels";
import { normalizeText } from "@/lib/utils/normalize-text";
import { plural, pluralWord } from "@/lib/utils/format";

export interface CatalogItem {
  slug: string;
  namePt: string;
  taglinePt: string;
  goal: string;
  experienceLevel: string;
  trainingStyle: string;
  equipmentAccess: string;
  daysPerWeek: number;
  durationWeeks: number;
  sessionMinutes: number;
  dayNames: string[];
  /** Equipment.id of every exercise (the recommender's runnable check); absent in older callers. */
  equipmentIds?: string[];
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export type ProgramGroupKey = "gd" | "start" | "core" | "focus" | "sport" | "home";

/** Library shelves, in display order. Every template lands in exactly one. */
export const PROGRAM_GROUPS: { key: ProgramGroupKey; label: string; blurb: string }[] = [
  { key: "gd", label: "Plano GD", blurb: "Blocos em sequência, 5×/semana. Comece pela Adaptação." },
  { key: "start", label: "Comece aqui", blurb: "Para quem está começando ou voltando a treinar." },
  { key: "core", label: "Força & hipertrofia", blurb: "Divisões clássicas para quem já treina." },
  { key: "focus", label: "Especializações", blurb: "Foco em um músculo ou método por algumas semanas." },
  { key: "sport", label: "Esporte", blurb: "Força a serviço de outro esporte." },
  { key: "home", label: "Casa & mínimo", blurb: "Halteres, kettlebell ou só o peso do corpo." },
];

/**
 * Templates that focus on one muscle group or one method. The catalog is
 * seeded content with stable slugs and has no "specialization" field, so the
 * list lives here; an unknown slug simply falls into its general shelf.
 */
export const FOCUS_SLUGS = new Set([
  "glute-focus",
  "arms-specialization",
  "back-focus",
  "chest-focus",
  "delts-3d",
  "legs-specialization",
  "high-frequency-squat",
  "lengthened-partials",
  "tempo-control",
  "metabolite-pump",
]);
/** Sport-oriented templates whose goal field doesn't say so. */
const SPORT_SLUGS = new Set(["hybrid-athlete"]);

export function isSportTemplate(t: Pick<CatalogItem, "slug" | "goal" | "trainingStyle">): boolean {
  return t.goal === "SPORTS_PERFORMANCE" || t.trainingStyle === "ENDURANCE_SUPPORT" || SPORT_SLUGS.has(t.slug);
}

/** Which shelf a template sits on. Precedence: GD series, equipment, sport, focus, level. */
export function programGroup(
  t: Pick<CatalogItem, "slug" | "goal" | "trainingStyle" | "equipmentAccess" | "experienceLevel">,
): ProgramGroupKey {
  if (t.slug.startsWith("gd-")) return "gd";
  if (t.equipmentAccess !== "FULL_GYM") return "home";
  if (isSportTemplate(t)) return "sport";
  if (FOCUS_SLUGS.has(t.slug)) return "focus";
  if (t.experienceLevel === "BEGINNER") return "start";
  return "core";
}

/**
 * The GD plan is one 2-year series of 9 blocks, and every later block's
 * audience assumes the ones before it ("Não use como primeiro bloco: comece
 * pelo GD Adaptação"). Only its entry points are a first program: the
 * Adaptação, and GD 1, whose audience also takes someone back to training for
 * a few months with good technique. GD 8's audience admits "~20 meses de
 * treino estruturado", but it closes the series with the 2-year test, so it
 * isn't offered as a start either.
 */
export const GD_ENTRY_SLUGS = new Set(["gd-adaptacao", "gd-1"]);
export function isMidSeriesGd(slug: string): boolean {
  return slug.startsWith("gd-") && !GD_ENTRY_SLUGS.has(slug);
}

/** Items split into the non-empty shelves, keeping the given order inside each. */
export function groupCatalog<T extends CatalogItem>(items: T[]) {
  return PROGRAM_GROUPS.map((g) => ({ ...g, items: items.filter((t) => programGroup(t) === g.key) })).filter(
    (g) => g.items.length > 0,
  );
}

/** The GD series' first block, where the "Plano GD" shelf's blurb says to start. */
export const GD_SERIES_START = "gd-adaptacao";

export interface Shelf<T> {
  key: ProgramGroupKey;
  label: string;
  blurb: string;
  items: T[];
  /** Shown ahead of `items` without being one of the matches: the series entry. */
  start: T | null;
}

/**
 * The shelves of a filtered library (chips preset from the profile, or picked):
 * - the shelf holding the user's pick comes first, led by the pick, so the
 *   "Para você" card is the library's first card;
 * - a "Plano GD" shelf holding only blocks from the middle of the series
 *   (what the chips of someone who already trains leave) is led by the
 *   series entry, since its blurb says "Comece pela Adaptação" and no
 *   mid-series block is a first program.
 * Unfiltered, the library keeps the catalog's own shelf order (groupCatalog).
 */
export function shelveFiltered<T extends CatalogItem>(filtered: T[], all: T[], pick: string | null): Shelf<T>[] {
  const shelves = groupCatalog(filtered).map((g) => {
    const items = [...g.items].sort((a, b) => Number(b.slug === pick) - Number(a.slug === pick));
    const needsStart = g.key === "gd" && !items.some((t) => GD_ENTRY_SLUGS.has(t.slug));
    return { ...g, items, start: needsStart ? (all.find((t) => t.slug === GD_SERIES_START) ?? null) : null };
  });
  const at = shelves.findIndex((s) => s.items.some((t) => t.slug === pick));
  if (at > 0) shelves.unshift(...shelves.splice(at, 1));
  return shelves;
}

// ---------------------------------------------------------------------------
// Facets (chip filters)
// ---------------------------------------------------------------------------

export type PlaceFacet = "gym" | "home" | "bodyweight";
export type GoalFacet = "hypertrophy" | "strength" | "fat-loss" | "fitness" | "sport";

export interface LibraryFilters {
  days: number | null;
  level: string | null;
  place: PlaceFacet | null;
  goal: GoalFacet | null;
}

export const NO_FILTERS: LibraryFilters = { days: null, level: null, place: null, goal: null };

export const DAY_OPTIONS = [2, 3, 4, 5, 6];
export const LEVEL_OPTIONS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((value) => ({
  value,
  label: EXPERIENCE_LABEL[value],
}));
export const PLACE_OPTIONS: { value: PlaceFacet; label: string }[] = [
  { value: "gym", label: "Academia" },
  { value: "home", label: "Casa" },
  { value: "bodyweight", label: "Peso do corpo" },
];
export const GOAL_OPTIONS: { value: GoalFacet; label: string }[] = [
  { value: "hypertrophy", label: "Hipertrofia" },
  { value: "strength", label: "Força" },
  { value: "fat-loss", label: "Emagrecer" },
  { value: "fitness", label: "Fitness geral" },
  { value: "sport", label: "Esporte" },
];

/**
 * The programs a beginner is started on (recommend.ts, beginnerEntrySlug):
 * the flagship adaptation at up to 4 days a week, the GD series entry at 5+.
 */
export const BEGINNER_ENTRY_SLUGS = new Set(["fgpower-adaptation", "gd-adaptacao"]);

/**
 * Programs that suit a fat-loss goal. None is built for it — and none needs
 * to be: lifting keeps the muscle while the diet does the losing — so this is
 * the general-fitness shelf plus full-body strength/hypertrophy plans, plus
 * the beginner entry programs (what a beginner who wants to lose fat is
 * recommended, so "Emagrecer" must show them).
 */
function suitsFatLoss(t: CatalogItem): boolean {
  if (t.goal === "GENERAL_FITNESS" || BEGINNER_ENTRY_SLUGS.has(t.slug)) return true;
  return t.trainingStyle === "FULL_BODY" && (t.goal === "HYPERTROPHY" || t.goal === "STRENGTH_HYPERTROPHY");
}

function matchesPlace(t: CatalogItem, place: PlaceFacet): boolean {
  if (place === "gym") return t.equipmentAccess === "FULL_GYM";
  if (place === "bodyweight") return t.equipmentAccess === "HOME_BODYWEIGHT";
  return t.equipmentAccess !== "FULL_GYM";
}

function matchesGoal(t: CatalogItem, goal: GoalFacet): boolean {
  switch (goal) {
    case "hypertrophy":
      return t.goal === "HYPERTROPHY" || t.goal === "STRENGTH_HYPERTROPHY";
    case "strength":
      return t.goal === "STRENGTH" || t.goal === "STRENGTH_HYPERTROPHY";
    case "fat-loss":
      return suitsFatLoss(t);
    case "fitness":
      return t.goal === "GENERAL_FITNESS";
    case "sport":
      return isSportTemplate(t);
  }
}

export function applyFilters<T extends CatalogItem>(items: T[], f: LibraryFilters): T[] {
  return items.filter(
    (t) =>
      (f.days === null || t.daysPerWeek === f.days) &&
      (f.level === null || t.experienceLevel === f.level) &&
      (f.place === null || matchesPlace(t, f.place)) &&
      (f.goal === null || matchesGoal(t, f.goal)),
  );
}

export function activeFilterCount(f: LibraryFilters): number {
  return [f.days, f.level, f.place, f.goal].filter((v) => v !== null).length;
}

export function sameFilters(a: LibraryFilters, b: LibraryFilters): boolean {
  return a.days === b.days && a.level === b.level && a.place === b.place && a.goal === b.goal;
}

export interface FilterProfile {
  goal: string;
  experience: string;
  daysPerWeek: number;
  equipmentAccess: string;
}

const PLACE_FOR_EQUIPMENT: Record<string, PlaceFacet> = {
  FULL_GYM: "gym",
  HOME_DUMBBELLS: "home",
  MINIMAL: "home",
  HOME_BODYWEIGHT: "bodyweight",
};
const GOAL_FACET_FOR_GOAL: Record<string, GoalFacet> = {
  HYPERTROPHY: "hypertrophy",
  STRENGTH: "strength",
  STRENGTH_HYPERTROPHY: "hypertrophy",
  GENERAL_FITNESS: "fitness",
  FAT_LOSS: "fat-loss",
  SPORTS_PERFORMANCE: "sport",
};

/** Programs that must be left for each preset facet (place, level, days, goal) to be applied. */
const PRESET_MIN_LEFT = [1, 2, 2, 3];

/**
 * The chips preselected from the user's profile. Facets are added in order of
 * how hard a constraint they are (place, level, days, goal) and only while
 * the library keeps a real choice — a 4-day beginner gets "Academia ·
 * Iniciante" rather than an empty screen (there is no 4-day beginner plan),
 * and the goal chip is only preset when it still leaves three programs.
 * Place is the exception: equipment you don't have is never shown by default,
 * even if only one program fits.
 *
 * `mustInclude` is the user's top recommendation: a chip that would hide it is
 * skipped, so the library never contradicts the "Para você" pick above it (a
 * beginner who wants fitness is started on the adaptation program, which the
 * "Fitness geral" chip alone would leave out).
 */
export function presetFilters(
  profile: FilterProfile,
  items: CatalogItem[],
  mustInclude: string | null = null,
): LibraryFilters {
  const candidates: Partial<LibraryFilters>[] = [
    { place: PLACE_FOR_EQUIPMENT[profile.equipmentAccess] ?? null },
    { level: profile.experience in EXPERIENCE_LABEL ? profile.experience : null },
    { days: Math.min(6, Math.max(2, Math.round(profile.daysPerWeek))) },
    { goal: GOAL_FACET_FOR_GOAL[profile.goal] ?? null },
  ];
  let filters = { ...NO_FILTERS };
  candidates.forEach((c, i) => {
    const next = { ...filters, ...c };
    const left = applyFilters(items, next);
    if (left.length < PRESET_MIN_LEFT[i]) return;
    if (mustInclude !== null && !left.some((t) => t.slug === mustInclude)) return;
    filters = next;
  });
  return filters;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Lowercase, accent-free, "5×5" as "5x5", hyphens and slashes as spaces. */
export function normalizeQuery(input: string): string {
  return normalizeText(input).replace(/×/g, "x").replace(/[-/]/g, " ").replace(/\s+/g, " ");
}

/** Every word a person might type to find a program: name, days, tagline, labels, equipment, length. */
export function searchTextFor(item: CatalogItem): string {
  return normalizeQuery(
    [
      item.namePt,
      ...item.dayNames,
      item.taglinePt,
      GOAL_LABEL[item.goal],
      EXPERIENCE_LABEL[item.experienceLevel],
      STYLE_LABEL[item.trainingStyle],
      STYLE_ALIASES[item.trainingStyle],
      EQUIPMENT_LABEL[item.equipmentAccess],
      `${item.durationWeeks} semanas`,
    ].join(" "),
  );
}

type Concept = "fat-loss" | "home" | "bodyweight" | "hypertrophy";

/** Multi-word phrases first; each maps a way of saying it to what it means. */
const CONCEPT_PHRASES: [RegExp, Concept][] = [
  [/\b(perder peso|perda de peso|queimar gordura|emagrec\w*|secar|definicao|definir|cutting|gordura)\b/g, "fat-loss"],
  [/\b(sem equipamentos?|peso do corpo|peso corporal|calistenia|sem peso)\b/g, "bodyweight"],
  [/\b(em casa|casa|sem academia|home)\b/g, "home"],
  [/\b(ganhar massa|massa muscular|massa|crescer)\b/g, "hypertrophy"],
];

/** Everyday words → the word the catalog uses. */
const TERM_SYNONYMS: Record<string, string> = {
  bumbum: "gluteo",
  corrida: "corredor",
  correr: "corredor",
  ciclismo: "ciclista",
  bike: "ciclista",
  pedal: "ciclista",
  luta: "lutador",
  mma: "lutador",
  jiu: "lutador",
  boxe: "lutador",
  escalada: "escalador",
  idoso: "maturidade",
  terceira: "maturidade",
  maquina: "maquinas",
};

/** Words that say nothing about which program ("treino", "para", "quero"). */
const STOPWORDS = new Set(
  "treino treinos programa programas protocolo protocolos de do da dos das para pra com e o a os as um uma por semana no na em quero meu minha".split(
    " ",
  ),
);

export interface ParsedQuery {
  /** Training days per week ("4 dias", "4x", "treino ABCD"). */
  days: number | null;
  /** Longest acceptable session ("30 min" → up to 35). */
  maxMinutes: number | null;
  concepts: Concept[];
  terms: string[];
  /** The whole query, normalized — a program named like it comes first. */
  phrase: string;
}

export function parseQuery(query: string): ParsedQuery {
  let q = ` ${normalizeQuery(query)} `;
  const phrase = q.trim();
  let days: number | null = null;
  let maxMinutes: number | null = null;
  const concepts: Concept[] = [];

  const minutes = /(\d+)\s*(?:min|minutos?|minuto)\b/.exec(q);
  if (minutes) {
    maxMinutes = Number(minutes[1]) + 5;
    q = q.replace(minutes[0], " ");
  }
  const d = /(\d+)\s*(?:x|dias?|vezes)\b/.exec(q);
  if (d) {
    days = Number(d[1]);
    q = q.replace(d[0], " ");
  }
  // "treino ABC" is the Brazilian way of saying a 3-day split.
  const abc = /\b(abcdef|abcde|abcd|abc)\b/.exec(q);
  if (abc) {
    days ??= abc[1].length;
    q = q.replace(abc[0], " ");
  }
  for (const [re, concept] of CONCEPT_PHRASES) {
    const rest = q.replace(re, " ");
    if (rest !== q && !concepts.includes(concept)) concepts.push(concept);
    q = rest;
  }
  const terms = q
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => TERM_SYNONYMS[t] ?? t)
    // plural → singular for longer words, so "iniciantes" finds "Iniciante" and "costas" finds "Costas"
    .map((t) => (t.length >= 5 && t.endsWith("s") && !/\d/.test(t) ? t.slice(0, -1) : t))
    .map((t) => TERM_SYNONYMS[t] ?? t);
  return { days, maxMinutes, concepts, terms, phrase };
}

/** A number must match as a whole number ("4" finds "4 dias", not "14" or "44"); words match anywhere. */
function termMatches(text: string, term: string): boolean {
  if (!/^\d+$/.test(term)) return text.includes(term);
  return new RegExp(`(^|\\D)${term}(\\D|$)`).test(text);
}

function conceptMatches(t: CatalogItem, c: Concept): boolean {
  switch (c) {
    case "fat-loss":
      return suitsFatLoss(t);
    case "home":
      return t.equipmentAccess !== "FULL_GYM";
    case "bodyweight":
      return t.equipmentAccess === "HOME_BODYWEIGHT";
    case "hypertrophy":
      return t.goal === "HYPERTROPHY" || t.goal === "STRENGTH_HYPERTROPHY";
  }
}

export interface SearchOutcome<T> {
  results: T[];
  /** The query was about losing fat: the UI shows the honest line. */
  fatLoss: boolean;
  /** Set when nothing matched exactly and the results are the closest ones. */
  note: string | null;
}

/**
 * Filters `items` by a free-text query. Every term and constraint must match
 * (accents ignored); a program whose name contains the whole query comes
 * first, the given order is kept otherwise. When a time or day constraint
 * leaves nothing, the closest programs are returned with a note saying so
 * instead of an empty screen.
 */
export function searchCatalog<T extends CatalogItem>(items: T[], query: string): SearchOutcome<T> {
  const p = parseQuery(query);
  const indexed = items.map((item) => ({ item, text: searchTextFor(item) }));
  const base = indexed.filter(
    ({ item, text }) => p.concepts.every((c) => conceptMatches(item, c)) && p.terms.every((t) => termMatches(text, t)),
  );
  const fits = (item: T, days: number | null, maxMinutes: number | null) =>
    (days === null || item.daysPerWeek === days) && (maxMinutes === null || item.sessionMinutes <= maxMinutes);
  const byName = (list: typeof base) =>
    [...list].sort(
      (a, b) =>
        Number(!normalizeQuery(a.item.namePt).includes(p.phrase)) -
        Number(!normalizeQuery(b.item.namePt).includes(p.phrase)),
    );

  let results = byName(base.filter(({ item }) => fits(item, p.days, p.maxMinutes))).map((x) => x.item);
  let note: string | null = null;
  if (results.length === 0 && p.maxMinutes !== null) {
    const asked = p.maxMinutes - 5;
    const candidates = base.filter(({ item }) => fits(item, p.days, null));
    const floor = Math.min(...candidates.map(({ item }) => item.sessionMinutes));
    const shortest = candidates
      .filter(({ item }) => item.sessionMinutes <= floor + 10)
      .sort((a, b) => a.item.sessionMinutes - b.item.sessionMinutes)
      .map((x) => x.item);
    if (shortest.length > 0) {
      results = shortest;
      note = `Nenhum programa cabe em ${asked} min — estes são os mais curtos.`;
    }
  }
  if (results.length === 0 && p.days !== null) {
    const near = base
      .filter(({ item }) => Math.abs(item.daysPerWeek - p.days!) === 1 && fits(item, null, p.maxMinutes))
      .map((x) => x.item);
    if (near.length > 0) {
      results = near;
      // Only the frequencies that actually came back: "estes têm 4 dias" / "estes têm 4 ou 6 dias".
      const found = [...new Set(near.map((t) => t.daysPerWeek))].sort((a, b) => a - b);
      note =
        `Nenhum programa de ${plural(p.days, "dia", "dias")} por semana com esses termos — ` +
        `estes têm ${found.join(" ou ")} ${pluralWord(found[found.length - 1], "dia", "dias")}.`;
    }
  }
  return { results, fatLoss: p.concepts.includes("fat-loss"), note };
}

export interface LibrarySearch<T> extends SearchOutcome<T> {
  /** The chips hid what was typed: these results come from the whole catalog. */
  widened: boolean;
  /** Set when widened: the line above the results saying why. */
  widenedNote: string | null;
}

const WIDENED_NOTE = "Nada com os filtros escolhidos — buscando em todos os programas.";
const exact = (o: SearchOutcome<unknown>) => o.results.length > 0 && o.note === null;
const shortest = (o: SearchOutcome<CatalogItem>) => Math.min(...o.results.map((t) => t.sessionMinutes));

/** A program's short name: "Divisão Clássica" of "Divisão Clássica — Um Músculo por Dia". */
function shortName(t: CatalogItem): string {
  return t.namePt.split(" — ")[0].trim();
}

/** The query starts with this program's short name ("GD 1", "divisao classica"): it was asked for by name. */
function namedBy(t: CatalogItem, phrase: string): boolean {
  const name = normalizeQuery(shortName(t)).trim();
  return name.length > 0 && phrase.startsWith(name) && (phrase.length === name.length || phrase[name.length] === " ");
}

/**
 * A search inside the chip-filtered library. The chips may be the profile
 * preset, which the user never picked, so they must not hide what was typed:
 * - a program asked for by name ("GD 1") that the chips hide widens the
 *   search, even when other programs inside the chips share a word with it;
 * - when the filtered search has no exact match (nothing, or only the
 *   closest fallback) and the whole catalog does better — an exact match,
 *   anything at all, or shorter sessions for "30 min" — the search widens.
 * Otherwise the fallback note says the filters are why.
 */
export function searchLibrary<T extends CatalogItem>(
  all: T[],
  filtered: T[],
  query: string,
  filtersOn: boolean,
): LibrarySearch<T> {
  const within = searchCatalog(filtered, query);
  if (!filtersOn) return { ...within, widened: false, widenedNote: null };
  const phrase = parseQuery(query).phrase;
  const hiddenByName = within.results.some((t) => namedBy(t, phrase))
    ? undefined
    : all.find((t) => namedBy(t, phrase));
  if (exact(within) && !hiddenByName) return { ...within, widened: false, widenedNote: null };
  const everywhere = searchCatalog(all, query);
  if (hiddenByName && everywhere.results.some((t) => t.slug === hiddenByName.slug)) {
    const widenedNote = `${shortName(hiddenByName)} está fora dos filtros escolhidos — buscando em todos os programas.`;
    return { ...everywhere, widened: true, widenedNote };
  }
  if (exact(within)) return { ...within, widened: false, widenedNote: null };
  const better =
    exact(everywhere) ||
    (within.results.length === 0 && everywhere.results.length > 0) ||
    (parseQuery(query).maxMinutes !== null &&
      everywhere.results.length > 0 &&
      shortest(everywhere) < shortest(within));
  if (better) return { ...everywhere, widened: true, widenedNote: WIDENED_NOTE };
  const note = within.note && `Com os filtros escolhidos, ${within.note[0].toLowerCase()}${within.note.slice(1)}`;
  return { ...within, note, widened: false, widenedNote: null };
}

/** Ready-made searches offered when a search finds nothing. */
export const SEARCH_SUGGESTIONS = ["iniciante", "3 dias", "em casa", "emagrecer", "GD", "hipertrofia"];
