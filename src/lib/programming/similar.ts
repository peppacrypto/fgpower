/**
 * "Parecidos" at the end of a program's dossier: the programs someone torn
 * between a few would compare it with — the same goal and level, with other
 * days, lengths or equipment — so they needn't open each dossier and keep the
 * numbers in their head. Pure; the catalog comes in as CatalogItems.
 */
import type { CatalogItem } from "./catalog";
import { isMidSeriesGd } from "./catalog";

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
/** Goals that answer the same wish ("ganhar massa" is both). */
const GOAL_FAMILY: Record<string, string> = {
  HYPERTROPHY: "size",
  STRENGTH_HYPERTROPHY: "size",
  STRENGTH: "strength",
  GENERAL_FITNESS: "fitness",
  FAT_LOSS: "fitness",
  SPORTS_PERFORMANCE: "sport",
};

const family = (goal: string) => GOAL_FAMILY[goal] ?? goal;
const levelGap = (a: CatalogItem, b: CatalogItem) =>
  Math.abs(LEVELS.indexOf(a.experienceLevel) - LEVELS.indexOf(b.experienceLevel));

function score(a: CatalogItem, b: CatalogItem): number {
  let s = 0;
  if (a.goal === b.goal) s += 3;
  else if (GOAL_FAMILY[a.goal] && GOAL_FAMILY[a.goal] === GOAL_FAMILY[b.goal]) s += 2;
  const gap = levelGap(a, b);
  if (gap === 0) s += 3;
  else if (gap === 1) s += 1;
  if (a.trainingStyle === b.trainingStyle) s += 1;
  if (Math.abs(a.daysPerWeek - b.daysPerWeek) <= 1) s += 1;
  return s;
}

/** Beyond the rule below, a pick needs a bit more in common (same goal or level, style, days). */
const MIN_SCORE = 4;

/**
 * What the dossier promises ("Mesmo objetivo e nível próximo"): the same goal
 * family and a level within one step. The score only ranks — it could reach
 * MIN_SCORE across goals (same level + style) or two levels apart.
 */
const comparable = (a: CatalogItem, b: CatalogItem) => family(a.goal) === family(b.goal) && levelGap(a, b) <= 1;

/**
 * Up to `limit` programs close to `current`, best first (catalog order breaks
 * ties). The GD series never lists its own blocks (the series rail does), and
 * no block from its middle is offered as a first program elsewhere.
 */
export function similarPrograms<T extends CatalogItem>(current: CatalogItem, all: T[], limit = 3): T[] {
  const inSeries = current.slug.startsWith("gd-");
  return all
    .map((t, i) => ({ t, i, s: score(current, t) }))
    .filter(({ t, s }) => {
      if (t.slug === current.slug || !comparable(current, t) || s < MIN_SCORE) return false;
      if (inSeries) return !t.slug.startsWith("gd-");
      return !isMidSeriesGd(t.slug);
    })
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map(({ t }) => t);
}
