import "server-only";

import { prisma } from "@/lib/db";
import { getTemplateBySlug, listTemplates, recommendProfileOf, toCatalogItem } from "@/lib/data/templates";
import {
  EQUIPMENT_FOR_ACCESS,
  adaptRowKey,
  assignStandIns,
  getAlternatives,
  mainGearFirst,
  rankStandIns,
  type AlternativeExercise,
} from "@/lib/data/alternatives";
import { ADAPT_LABEL, GOAL_LABEL } from "@/lib/constants/program-labels";
import { recommendTemplates, type RecommendProfile } from "@/lib/programming/recommend";
import { forkTemplateToProgram, startProgramInternal, type ForkAdapt } from "@/lib/programming/enroll";
import { trimToSessionMinutes, type FitExercise } from "@/lib/programming/session-fit";

/**
 * The end of the new-user onboarding: instead of landing on an empty Today with
 * a shelf of programs, the wizard hands the user one ready, personalised plan,
 * active and one tap from the first set.
 *
 * "Misto", as decided: it starts from the best CURATED program (the same
 * deterministic recommender the library uses — the pick is never random) and
 * then adjusts the user's own copy — swapping exercises their equipment can't
 * do (the auto version of "Adaptar", with the review's defaults) and trimming
 * trailing accessory sets when a day runs past the time they said they have.
 * The curated program, the recommender and everyone already past onboarding are
 * untouched. If nothing fits (very rare), it enrolls no one and Today falls back
 * to its recommendation panel — never a blank page.
 */

/** How many stand-ins each adapted exercise is offered (same as the /adapt review). */
const ADAPT_OPTIONS = 5;

interface AutoEnrollProfile {
  goal: string;
  experience: string;
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentAccess: string;
  doesEndurance: boolean;
  onboardingCompletedAt: Date | null;
}

export interface AutoEnrollResult {
  activated: boolean;
  /** The name given to the activated program, for the Today welcome banner. */
  programName?: string;
}

/**
 * Builds and activates the plan for a user who just finished onboarding. Reads
 * the profile the wizard has already written. Safe to call even if it can't
 * find a fit — it simply returns `{ activated: false }` and leaves the account
 * program-less (Today then shows its recommendation panel, as before).
 */
export async function autoEnrollFromOnboarding(userId: string): Promise<AutoEnrollResult> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      goal: true,
      experience: true,
      daysPerWeek: true,
      sessionMinutes: true,
      equipmentAccess: true,
      doesEndurance: true,
      onboardingCompletedAt: true,
    },
  });
  const answers = recommendProfileOf(profile as AutoEnrollProfile | null);
  if (!answers) return { activated: false };

  // The pick: the same ranking the library's "Para você" uses. A brand-new
  // account has no training history, so no GD block is excluded.
  const templates = await listTemplates();
  const picks = recommendTemplates(answers, templates.map(toCatalogItem), {});
  const pick = picks[0];
  if (!pick) return { activated: false };

  const slug = pick.template.slug;
  const name = personalizedName(answers);

  // Auto "Adaptar" when the pick needs gear the user doesn't have: the review's
  // default stand-in for each exercise, no screen in between.
  const swaps = pick.adapt ? await defaultSwaps(slug, answers.equipmentAccess) : new Map();
  const adapt: ForkAdapt = { swaps, name };

  const program = await forkTemplateToProgram(slug, userId, adapt);
  await fitProgramToSessions(program.id, answers.sessionMinutes);

  const started = await startProgramInternal(userId, program.id);
  // EMPTY shouldn't happen (the recommender only returns runnable/adaptable
  // templates, and adapting keeps every row), but if activation is refused for
  // any reason the fork stays as a draft on the shelf — never a half-state.
  if (!started.ok) return { activated: false };
  return { activated: true, programName: name };
}

/** "Seu plano — Hipertrofia · 3×/semana" (capped at the column width). */
function personalizedName(answers: RecommendProfile): string {
  const goal = GOAL_LABEL[answers.goal] ?? "Treino";
  const days = `${answers.daysPerWeek}×/semana`;
  return `Seu plano — ${goal} · ${days}`.slice(0, 120);
}

/**
 * The review's default swaps, computed headlessly: for every exercise the
 * user's equipment can't do, the same stand-in "Adaptar para …" would pre-select
 * (lib/data/alternatives), keyed the way `forkTemplateToProgram` reads them.
 * Mirrors the /adapt page and the adaptTemplate action, minus the UI.
 */
async function defaultSwaps(slug: string, equipmentAccess: string): Promise<ForkAdapt["swaps"]> {
  const swaps: ForkAdapt["swaps"] = new Map();
  const allowed = EQUIPMENT_FOR_ACCESS[equipmentAccess] ?? null;
  // FULL_GYM (allowed === null) or an access with no "Adaptar" label never swaps.
  if (allowed === null || !ADAPT_LABEL[equipmentAccess]) return swaps;

  const template = await getTemplateBySlug(slug);
  if (!template) return swaps;
  const usable = (equipmentId: string | null) => equipmentId !== null && allowed.includes(equipmentId);

  const needing = [
    ...new Set(
      template.days.flatMap((d) => d.exercises.filter((ex) => !usable(ex.exercise.equipmentId)).map((ex) => ex.exerciseId)),
    ),
  ];
  const alternatives = new Map<string, AlternativeExercise[]>(
    await Promise.all(
      needing.map(async (id) => [id, await getAlternatives(id, { equipmentAccess, limit: ADAPT_OPTIONS + 3 })] as const),
    ),
  );

  for (const day of template.days) {
    const assigned = assignStandIns(
      day.exercises.map((ex) => ({
        ex,
        exerciseId: ex.exerciseId,
        usableNow: usable(ex.exercise.equipmentId),
        difficulty: ex.exercise.difficulty,
        candidates: rankStandIns(mainGearFirst(alternatives.get(ex.exerciseId) ?? [], equipmentAccess), ex.exercise.difficulty),
      })),
      ADAPT_OPTIONS,
    );
    for (const a of assigned) {
      if (a.kind !== "swap" || !a.pick || !a.reps) continue;
      const noteSuffix =
        a.reps.shift === "harder"
          ? ` Variação mais difícil: ${a.ex.sets}×${a.reps.repMin}, parando 1–2 antes da falha.`
          : a.reps.shift === "easier"
            ? ` Variação mais fácil: dá para fazer ${a.ex.sets}×${a.reps.repMax}.`
            : "";
      swaps.set(adaptRowKey(day.dayIndex, a.ex), {
        exerciseId: a.pick.id,
        replaces: a.ex.exercise.namePt,
        repMin: a.reps.repMin,
        repMax: a.reps.repMax,
        noteSuffix,
      });
    }
  }
  return swaps;
}

/**
 * Trims the freshly forked program's days to the user's session length, shaving
 * trailing accessory sets (session-fit). Reads the user's own copy — compounds
 * stay whole, nothing drops below two working sets, and a day already within
 * budget is left exactly as the curated plan wrote it.
 */
async function fitProgramToSessions(programId: string, sessionMinutes: number): Promise<void> {
  const program = await prisma.userProgram.findUnique({
    where: { id: programId },
    select: {
      days: {
        select: {
          exercises: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, sets: true, repMax: true, restSeconds: true, warmupSets: true, exercise: { select: { mechanics: true } } },
          },
        },
      },
    },
  });
  if (!program) return;

  const updates: { id: string; sets: number }[] = [];
  for (const day of program.days) {
    const fit: FitExercise[] = day.exercises.map((ex) => ({
      id: ex.id,
      sets: ex.sets,
      repMax: ex.repMax,
      restSeconds: ex.restSeconds,
      warmupSets: ex.warmupSets,
      isCompound: ex.exercise.mechanics === "COMPOUND",
    }));
    const { trims } = trimToSessionMinutes(fit, sessionMinutes);
    for (const [id, sets] of trims) updates.push({ id, sets });
  }
  if (updates.length === 0) return;
  await prisma.$transaction(updates.map((u) => prisma.userProgramExercise.update({ where: { id: u.id }, data: { sets: u.sets } })));
}
