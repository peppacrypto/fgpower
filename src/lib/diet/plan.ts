/**
 * Dieta: a user's eating plan and what was eaten each day — health data,
 * owner-only (nothing here ever reaches /u, /t, the feed or an image). The
 * plan's shape and the day's math, pure and zod-free so the client screens can
 * import it (A-089); lib/validation/diet-plan checks a plan against these same
 * types (DietPlanInSync).
 *
 * A plan is meals of items; an item may name alternatives that fill its place
 * on a given day (a can of sardines for the chicken). A day marks each item
 * eaten or not and which option filled it. Items are identified by the plan's
 * own ids ("m2-frango"), unique across the plan.
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

export interface DietItem extends DietOption {
  alternatives?: DietOption[];
}

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

/** One item on one day: eaten or not, and the alternative picked (null = the item itself). */
export interface DietMark {
  eaten: boolean;
  choiceId: string | null;
}

/** A day's marks by item id. Items without one are not eaten, the item itself. */
export type DietDayMarks = Readonly<Record<string, DietMark>>;

export const NO_MARK: DietMark = Object.freeze({ eaten: false, choiceId: null });

/** The mark of an item (an own property only: an id like "constructor" reads nothing inherited). */
export function markOf(marks: DietDayMarks, itemId: string): DietMark {
  return Object.hasOwn(marks, itemId) ? marks[itemId] : NO_MARK;
}

/** The option filling an item's place: the alternative picked, else (unknown or none) the item itself. */
export function optionOf(item: DietItem, choiceId: string | null | undefined): DietOption {
  if (choiceId == null || choiceId === item.id) return item;
  return item.alternatives?.find((a) => a.id === choiceId) ?? item;
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
 * What the eaten items add up to, each by the option that filled it (the
 * sardines' kcal on a sardine day). Marks for ids the plan doesn't have (a plan
 * changed since) count for nothing. Rounded to 0.1.
 */
export function dayTotals(meals: readonly DietMeal[], marks: DietDayMarks): DietTotals {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0, eaten: 0, items: 0 };
  for (const item of planItems(meals)) {
    sum.items += 1;
    const mark = markOf(marks, item.id);
    if (!mark.eaten) continue;
    const o = optionOf(item, mark.choiceId);
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
  for (const item of planItems(meals)) all[item.id] = { eaten: true, choiceId: null };
  return dayTotals(meals, all);
}
