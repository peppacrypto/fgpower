/**
 * Picks ready-made programs for a user from their onboarding answers. Pure and
 * deterministic: equipment is a hard filter (a program needing a barbell is
 * never offered to someone training at home), then every template that fits
 * is scored on experience, days per week, session length, goal and
 * sport/endurance. The scores are plain heuristics, weighted so that the
 * things a user can't change about their week (days, time) outweigh taste.
 */
import { EQUIPMENT_LABEL, EXPERIENCE_LABEL } from "@/lib/constants/program-labels";
import { GD_SERIES } from "@/lib/training/program-calendar";
import { FOCUS_SLUGS, isMidSeriesGd, isSportTemplate } from "./catalog";

export { GD_ENTRY_SLUGS, isMidSeriesGd } from "./catalog";

export interface RecommendProfile {
  goal: string;
  experience: string;
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentAccess: string;
  doesEndurance?: boolean;
}

export interface RecommendableTemplate {
  slug: string;
  goal: string;
  experienceLevel: string;
  trainingStyle: string;
  equipmentAccess: string;
  daysPerWeek: number;
  durationWeeks: number;
  sessionMinutes: number;
}

/** One mono chip explaining the pick; `match` = it agrees with what the user said. */
export interface ReasonChip {
  label: string;
  match: boolean;
}

export interface Recommendation<T> {
  template: T;
  score: number;
  reasons: ReasonChip[];
}

/**
 * What each kind of access can run. A gym has everything; dumbbells at home
 * cover dumbbell and bodyweight plans; bands/kettlebell cover the minimal and
 * bodyweight ones; bodyweight only covers bodyweight.
 */
const CAN_RUN: Record<string, string[]> = {
  FULL_GYM: ["FULL_GYM", "HOME_DUMBBELLS", "MINIMAL", "HOME_BODYWEIGHT"],
  HOME_DUMBBELLS: ["HOME_DUMBBELLS", "HOME_BODYWEIGHT"],
  MINIMAL: ["MINIMAL", "HOME_BODYWEIGHT"],
  HOME_BODYWEIGHT: ["HOME_BODYWEIGHT"],
};

export function canRun(userEquipment: string, templateEquipment: string): boolean {
  return (CAN_RUN[userEquipment] ?? CAN_RUN.FULL_GYM).includes(templateEquipment);
}

const LEVEL: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

/**
 * Goals that serve each other. Programs are never built for fat loss:
 * FAT_LOSS scores as GENERAL_FITNESS (lifting keeps the muscle, the diet does
 * the losing), with hypertrophy and full-body plans as close seconds.
 */
const RELATED_GOALS: Record<string, string[]> = {
  HYPERTROPHY: ["STRENGTH_HYPERTROPHY"],
  STRENGTH: ["STRENGTH_HYPERTROPHY"],
  STRENGTH_HYPERTROPHY: ["HYPERTROPHY", "STRENGTH"],
  GENERAL_FITNESS: ["STRENGTH_HYPERTROPHY", "HYPERTROPHY"],
  SPORTS_PERFORMANCE: ["STRENGTH_HYPERTROPHY", "STRENGTH"],
};

/** Programs written for a specific audience: fine to pick, never a default. */
const AUDIENCE_PENALTY: Record<string, number> = { "silver-strength-50plus": 10, "desk-worker": 5 };

/**
 * The default first program for a beginner, when it fits their week:
 * training 5+ days → "gd-adaptacao", the entry block of the GD series (there
 * is no 6-day beginner plan, so 6 days also starts there); fewer days → the
 * flagship "fgpower-adaptation" (3×/week). "Fits" = the user can run it, at
 * most one day per week off, and at most 15 min longer than their session.
 * When the entry doesn't fit, the plain score order decides.
 */
export function beginnerEntrySlug(profile: RecommendProfile): string {
  return profile.daysPerWeek >= 5 ? "gd-adaptacao" : "fgpower-adaptation";
}
const ENTRY_BONUS = 100;

function fitsWeek(profile: RecommendProfile, t: RecommendableTemplate): boolean {
  return Math.abs(t.daysPerWeek - profile.daysPerWeek) <= 1 && t.sessionMinutes <= profile.sessionMinutes + 15;
}

export function scoreTemplate(profile: RecommendProfile, t: RecommendableTemplate): number {
  let score = 0;

  // Experience: the right level first; one below is fine; two below (a
  // beginner plan for an advanced lifter) is a poor fit; above is a stretch.
  const levelDiff = (LEVEL[t.experienceLevel] ?? 1) - (LEVEL[profile.experience] ?? 0);
  score += levelDiff === 0 ? 30 : levelDiff === -1 ? 12 : levelDiff === -2 ? -10 : levelDiff === 1 ? -20 : -60;

  // Days per week: each day off the user's week costs a lot, and two or more
  // days off all but rules it out, whatever the level. A plan that needs a day
  // the user doesn't have costs more than a goal match earns (a 3-day plan
  // doesn't fit a 2-day week; a 2-day plan in a 3-day week just leaves a
  // day free), so a plan that fits the week beats one that fits the goal.
  const daysOff = Math.abs(t.daysPerWeek - profile.daysPerWeek);
  const daysShort = Math.max(0, t.daysPerWeek - profile.daysPerWeek);
  score -= 15 * daysOff + 8 * daysShort + (daysOff >= 2 ? 30 : 0);

  // Session length: longer than the user has hurts; shorter barely matters.
  const over = t.sessionMinutes - profile.sessionMinutes;
  score -= over > 0 ? 0.8 * over : 0.15 * -over;

  // Goal.
  const goal = profile.goal === "FAT_LOSS" ? "GENERAL_FITNESS" : profile.goal;
  if (t.goal === goal) score += 20;
  else if (RELATED_GOALS[goal]?.includes(t.goal)) score += 10;
  if (profile.goal === "FAT_LOSS" && t.trainingStyle === "FULL_BODY") score += 6;

  // Sport and endurance plans are for athletes of that sport, and a treat for them.
  const athlete = profile.doesEndurance || profile.goal === "SPORTS_PERFORMANCE";
  if (isSportTemplate(t)) {
    score += athlete ? 15 + (profile.doesEndurance && t.trainingStyle === "ENDURANCE_SUPPORT" ? 5 : 0) : -25;
  }

  // Not a first program: a specialization block, a GD block from the middle
  // of the series or a one-week deload.
  if (FOCUS_SLUGS.has(t.slug)) score -= 15;
  if (isMidSeriesGd(t.slug)) score -= 40;
  if (t.durationWeeks < 3) score -= 40;
  score -= AUDIENCE_PENALTY[t.slug] ?? 0;

  // Equipment: a gym member is better served by a gym program than a home
  // one; at home, a plan built for exactly what you own beats a bodyweight one.
  if (profile.equipmentAccess === "FULL_GYM" && t.equipmentAccess !== "FULL_GYM") score -= 25;
  else if (profile.equipmentAccess !== "FULL_GYM" && t.equipmentAccess === profile.equipmentAccess) score += 8;

  if (profile.experience === "BEGINNER" && t.slug === beginnerEntrySlug(profile) && fitsWeek(profile, t)) {
    score += ENTRY_BONUS;
  }
  return score;
}

/** Chips for a pick: "3×/SEMANA · INICIANTE · ACADEMIA COMPLETA · 60 MIN". */
export function reasonChips(profile: RecommendProfile, t: RecommendableTemplate): ReasonChip[] {
  return [
    { label: `${t.daysPerWeek}×/semana`, match: t.daysPerWeek === profile.daysPerWeek },
    {
      label: EXPERIENCE_LABEL[t.experienceLevel] ?? t.experienceLevel,
      match: t.experienceLevel === profile.experience,
    },
    {
      label: EQUIPMENT_LABEL[t.equipmentAccess] ?? t.equipmentAccess,
      match: t.equipmentAccess === profile.equipmentAccess,
    },
    { label: `${t.sessionMinutes} min`, match: t.sessionMinutes <= profile.sessionMinutes },
  ];
}

/**
 * Where the user is in the GD series: the blocks they finished, and one they
 * stopped mid-way (it's resumed — "Retomar da semana N" — not started over).
 * The series goes on from the furthest block finished — its next block leads
 * the picks — and the blocks behind it drop out (a GD 1 graduate is never
 * sent back to the Adaptação, nor offered GD 1 again as a new program). A
 * stopped block drops out by itself: the blocks before it that were never
 * finished stay (someone who stopped GD 1 without the Adaptação may step
 * back to it).
 */
export interface SeriesHistory {
  finishedGd?: readonly string[];
  stoppedGd?: string | null;
}

/** The GD blocks left behind (finished and those before them, and the stopped one) and the one that comes next. */
export function seriesStanding(history: SeriesHistory = {}): { passed: Set<string>; next: string | null } {
  const series = GD_SERIES as readonly string[];
  const furthest = Math.max(-1, ...(history.finishedGd ?? []).map((slug) => series.indexOf(slug)));
  const passed = new Set(series.slice(0, furthest + 1));
  if (history.stoppedGd && series.includes(history.stoppedGd)) passed.add(history.stoppedGd);
  const next = furthest >= 0 ? (series[furthest + 1] ?? null) : null;
  return { passed, next: next && !passed.has(next) ? next : null };
}

/**
 * Every template the user can run, best first (ties keep the given order —
 * the catalog's own: flagship, then sortOrder). Empty when nothing fits the
 * equipment. After a finished GD block, the series' next block leads and the
 * blocks behind it are left out (seriesStanding).
 */
export function recommendTemplates<T extends RecommendableTemplate>(
  profile: RecommendProfile,
  templates: T[],
  history: SeriesHistory = {},
): Recommendation<T>[] {
  const { passed, next } = seriesStanding(history);
  return templates
    .map((template, i) => ({ template, i, score: scoreTemplate(profile, template) }))
    .filter(({ template }) => canRun(profile.equipmentAccess, template.equipmentAccess) && !passed.has(template.slug))
    .sort((a, b) => Number(b.template.slug === next) - Number(a.template.slug === next) || b.score - a.score || a.i - b.i)
    .map(({ template, score }) => ({ template, score, reasons: reasonChips(profile, template) }));
}
