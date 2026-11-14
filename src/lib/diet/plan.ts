/**
 * Dieta: a user's eating plan and what was eaten each day — health data,
 * owner-only (nothing here ever reaches /u, /t, the feed or an image). The
 * plan's shape and the day's math, pure and zod-free so the client screens can
 * import it (A-089); lib/validation/diet-plan checks a plan against these same
 * types (DietPlanInSync).
 *
 * A plan is meals of items; an item may name alternatives that fill its place
 * on a given day (a can of sardines for the chicken), or be counted in pieces
 * of a few kinds (eggs, with or without the yolk). A day marks each item eaten
 * or not, which option filled it and, for pieces, how many of each kind. Items
 * are identified by the plan's own ids ("m2-frango"), unique across the plan.
 */

/** One way to fill an item's place: the item itself or one of its alternatives. */
export interface DietOption {
  id: string;
  food: string;
  /** A short name for the choice ("Sardinha"); the food's name otherwise. */
  label?: string;
  /** "50 g", "1 lata (≈ 85 g)", "à vontade". */
  amount: string;
  /** The household measure: "½ xícara cheia", "1 filé pequeno". */
  measure?: string;
  grams?: number;
  kcal: number;
  /** Grams of each macro. */
  protein: number;
  carbs: number;
  fat: number;
}

/** Most pieces of one kind a day can count for an item (a meal's eggs). */
export const MAX_PIECES = 20;

/** One kind of piece an item is counted in ("Com gema": a whole egg), with the numbers of one piece. */
export interface DietPieceKind {
  id: string;
  /** The counter's name, short ("Com gema", "Sem gema"). */
  label: string;
  /** What one piece is: "Ovo inteiro cozido". */
  food: string;
  /** One piece in words: "1 ovo (≈ 50 g)". */
  amount: string;
  grams?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** How many the plan has. */
  planned: number;
}

/**
 * An item eaten in pieces, counted by kind: eggs with the yolk and without it.
 * The day says how many of each; the item's own words and numbers are its
 * planned pieces' (the schema checks they add up).
 */
export interface DietPieces {
  /** The piece's name: "ovo", and for more than one, "ovos". */
  one: string;
  many: string;
  kinds: DietPieceKind[];
}

export interface DietItem extends DietOption {
  alternatives?: DietOption[];
  pieces?: DietPieces;
}

/** Pieces eaten, by kind id. */
export type DietCounts = Readonly<Record<string, number>>;

export interface DietMeal {
  id: string;
  name: string;
  items: DietItem[];
}

/** The day's targets: kcal, then grams. Fiber is a target only (items don't carry it). */
export interface DietTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface DietPlan {
  title: string;
  /** The plan's own label (its date). */
  version?: string;
  /** The aim, in words. */
  goal?: string;
  targets: DietTargets;
  meals: DietMeal[];
  swaps: string[];
  rules: string[];
}

/** One item on one day: eaten or not, the alternative picked (null = the item itself) and, for pieces, how many. */
export interface DietMark {
  eaten: boolean;
  choiceId: string | null;
  /** An item counted in pieces: how many of each kind; null = as the plan has them. */
  counts: DietCounts | null;
}

/** A day's marks by item id. Items without one are not eaten, the item itself. */
export type DietDayMarks = Readonly<Record<string, DietMark>>;

export const NO_MARK: DietMark = Object.freeze({ eaten: false, choiceId: null, counts: null });

/** The mark of an item (an own property only: an id like "constructor" reads nothing inherited). */
export function markOf(marks: DietDayMarks, itemId: string): DietMark {
  return Object.hasOwn(marks, itemId) ? marks[itemId] : NO_MARK;
}

/** The option filling an item's place: the alternative picked, else (unknown or none) the item itself. */
export function optionOf(item: DietItem, choiceId: string | null | undefined): DietOption {
  if (choiceId == null || choiceId === item.id) return item;
  return item.alternatives?.find((a) => a.id === choiceId) ?? item;
}

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_PIECES;

/**
 * How many of each kind, by kind id: the mark's own counts when they name every
 * kind of the item with a whole number up to MAX_PIECES, else the plan's (counts
 * kept under a plan whose kinds changed since read as planned).
 */
export function countsOf(pieces: DietPieces, counts: DietCounts | null | undefined): Record<string, number> {
  const own = counts != null && pieces.kinds.every((k) => Object.hasOwn(counts, k.id) && isCount(counts[k.id])) ? counts : null;
  return Object.fromEntries(pieces.kinds.map((k) => [k.id, own ? own[k.id] : k.planned]));
}

/** Pieces of every kind together. */
export function piecesTotal(counts: DietCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

/**
 * Counts as a mark keeps them: null when they are the plan's own (nothing to
 * keep), else one whole number per kind, from what was given (a kind it lacks:
 * as planned). Undefined when they can't be this item's counts at all — a kind
 * it doesn't have, a number that isn't a whole one from 0 to MAX_PIECES.
 */
export function keptCounts(pieces: DietPieces, given: unknown): DietCounts | null | undefined {
  if (given == null) return null;
  if (typeof given !== "object" || Array.isArray(given)) return undefined;
  const g = given as Record<string, unknown>;
  const ids = new Set(pieces.kinds.map((k) => k.id));
  if (Object.keys(g).some((key) => !ids.has(key))) return undefined;
  const counts: Record<string, number> = {};
  for (const k of pieces.kinds) {
    const v = Object.hasOwn(g, k.id) ? g[k.id] : k.planned;
    if (!isCount(v)) return undefined;
    counts[k.id] = v;
  }
  return pieces.kinds.every((k) => counts[k.id] === k.planned) ? null : counts;
}

/** A kind's label inside a sentence: "Com gema" → "com gema". */
export function kindWords(kind: Pick<DietPieceKind, "label">): string {
  return kind.label.charAt(0).toLocaleLowerCase("pt-BR") + kind.label.slice(1);
}

/** Pieces in words: "3 ovos com gema", "1 ovo sem gema", "4 ovos: 2 com gema, 2 sem gema", "0 ovos". */
export function piecesAmount(pieces: DietPieces, counts: DietCounts): string {
  const total = pieces.kinds.reduce((sum, k) => sum + (counts[k.id] ?? 0), 0);
  const head = `${total} ${total === 1 ? pieces.one : pieces.many}`;
  const some = pieces.kinds.filter((k) => (counts[k.id] ?? 0) > 0);
  if (pieces.kinds.length === 1 || some.length === 0) return head;
  if (some.length === 1) return `${head} ${kindWords(some[0])}`;
  return `${head}: ${some.map((k) => `${counts[k.id]} ${kindWords(k)}`).join(", ")}`;
}

const hundredth = (n: number) => Math.round(n * 100) / 100;

/**
 * What filled an item's place on a day, as one option: the alternative picked;
 * for an item counted in pieces with counts of its own, those pieces added up
 * and put in words ("4 ovos: 2 com gema, 2 sem gema"); else the item itself.
 */
export function servingOf(item: DietItem, mark: Pick<DietMark, "choiceId" | "counts">): DietOption {
  const pieces = item.pieces;
  if (!pieces || mark.counts == null) return optionOf(item, mark.choiceId);
  const n = countsOf(pieces, mark.counts);
  if (pieces.kinds.every((k) => n[k.id] === k.planned)) return item;
  const sum = (key: "kcal" | "protein" | "carbs" | "fat") => hundredth(pieces.kinds.reduce((s, k) => s + n[k.id] * k[key], 0));
  const weighed = pieces.kinds.every((k) => k.grams != null);
  return {
    id: item.id,
    food: item.food,
    ...(item.label ? { label: item.label } : {}),
    amount: piecesAmount(pieces, n),
    ...(item.measure ? { measure: item.measure } : {}),
    ...(weighed ? { grams: hundredth(pieces.kinds.reduce((s, k) => s + n[k.id] * (k.grams ?? 0), 0)) } : {}),
    kcal: sum("kcal"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
  };
}

/** An item and the meal it belongs to, by the item's id. */
export function findItem(meals: readonly DietMeal[], itemId: string): { meal: DietMeal; item: DietItem } | null {
  for (const meal of meals) {
    const item = meal.items.find((i) => i.id === itemId);
    if (item) return { meal, item };
  }
  return null;
}

/** Every item of the plan, in order. */
export function planItems(meals: readonly DietMeal[]): DietItem[] {
  return meals.flatMap((m) => m.items);
}

/** The words on an option's choice chip: its label, else its food up to the first comma ("Sardinha em lata"). */
export function choiceLabel(option: DietOption): string {
  if (option.label) return option.label;
  const head = option.food.split(",")[0]?.trim();
  return head || option.food;
}

export interface DietTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Items marked eaten. */
  eaten: number;
  /** Items in the plan (an alternative fills an item's place: it is not one more). */
  items: number;
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/**
 * What the eaten items add up to, each by what filled it (the sardines' kcal on
 * a sardine day, four eggs' on a four-egg day). Marks for ids the plan doesn't
 * have (a plan changed since) count for nothing. Rounded to 0.1.
 */
export function dayTotals(meals: readonly DietMeal[], marks: DietDayMarks): DietTotals {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0, eaten: 0, items: 0 };
  for (const item of planItems(meals)) {
    sum.items += 1;
    const mark = markOf(marks, item.id);
    if (!mark.eaten) continue;
    const o = servingOf(item, mark);
    sum.eaten += 1;
    sum.kcal += o.kcal;
    sum.protein += o.protein;
    sum.carbs += o.carbs;
    sum.fat += o.fat;
  }
  return { ...sum, kcal: tenth(sum.kcal), protein: tenth(sum.protein), carbs: tenth(sum.carbs), fat: tenth(sum.fat) };
}

/** The whole plan eaten as written (each item itself): what the import checks against the targets. */
export function planTotals(meals: readonly DietMeal[]): DietTotals {
  const all: Record<string, DietMark> = {};
  for (const item of planItems(meals)) all[item.id] = { eaten: true, choiceId: null, counts: null };
  return dayTotals(meals, all);
}
