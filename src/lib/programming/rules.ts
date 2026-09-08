/**
 * Deterministic "smart program feedback" (spec §12). No AI/LLM involved —
 * every rule here is a plain, explainable heuristic over the program
 * structure. Thresholds are documented, with their evidentiary basis, in
 * docs/PROGRAMMING_RULES.md. These are heuristics, not prohibitions: the
 * UI always frames them as guidance a user can ignore.
 */

import { MUSCLE_GROUP_LABEL, type MuscleGroupTag } from "@/lib/constants/muscle-groups";

export type { MuscleGroupTag };

export interface ProgramRuleExercise {
  exerciseId: string;
  nameEn: string;
  namePt: string;
  primaryMuscleGroups: MuscleGroupTag[];
  movementPattern: string | null;
  sets: number;
}

export interface ProgramRuleDay {
  dayIndex: number;
  nameEn: string;
  namePt: string;
  exercises: ProgramRuleExercise[];
}

export interface ProgramFeedbackItem {
  code: string;
  severity: "info" | "notice";
  messageEn: string;
  messagePt: string;
}

// Thresholds — see docs/PROGRAMMING_RULES.md for the evidence behind these numbers.
const LOW_WEEKLY_SETS_THRESHOLD = 4;
const HIGH_WEEKLY_SETS_THRESHOLD = 28;
const HIGH_SESSION_WORKING_SETS_THRESHOLD = 30;
const SIMILAR_MOVEMENT_MIN_COUNT = 3;
const LOWER_BODY_HEAVY_SET_THRESHOLD = 3;

const LOWER_BODY_GROUPS: MuscleGroupTag[] = ["LEGS", "GLUTES"];

function weeklySetsByMuscleGroup(days: ProgramRuleDay[]): Map<MuscleGroupTag, number> {
  const totals = new Map<MuscleGroupTag, number>();
  for (const day of days) {
    for (const ex of day.exercises) {
      for (const group of ex.primaryMuscleGroups) {
        totals.set(group, (totals.get(group) ?? 0) + ex.sets);
      }
    }
  }
  return totals;
}

function isLowerBodyHeavy(day: ProgramRuleDay): boolean {
  const lowerSets = day.exercises
    .filter((e) => e.primaryMuscleGroups.some((g) => LOWER_BODY_GROUPS.includes(g)))
    .reduce((sum, e) => sum + e.sets, 0);
  return lowerSets >= LOWER_BODY_HEAVY_SET_THRESHOLD;
}

const GROUP_LABEL = MUSCLE_GROUP_LABEL;

export function analyzeProgram(days: ProgramRuleDay[]): ProgramFeedbackItem[] {
  const feedback: ProgramFeedbackItem[] = [];

  // 1. Weekly volume per muscle group.
  const weekly = weeklySetsByMuscleGroup(days);
  for (const [group, sets] of weekly) {
    if (group === "FULL_BODY" || group === "NECK") continue;
    const label = GROUP_LABEL[group];
    if (sets > 0 && sets < LOW_WEEKLY_SETS_THRESHOLD) {
      feedback.push({
        code: `low-volume-${group.toLowerCase()}`,
        severity: "notice",
        messageEn: `${capitalize(label.en)} currently receives about ${sets} direct set${sets === 1 ? "" : "s"}/week. That may be low if hypertrophy for this muscle is a priority.`,
        messagePt: `O ${label.pt} está recebendo cerca de ${sets} série${sets === 1 ? "" : "s"} diretas/semana. Isso pode ser pouco se a hipertrofia desse músculo for prioridade.`,
      });
    }
    if (sets > HIGH_WEEKLY_SETS_THRESHOLD) {
      feedback.push({
        code: `high-volume-${group.toLowerCase()}`,
        severity: "notice",
        messageEn: `${capitalize(label.en)} is programmed for about ${sets} sets/week, which is on the high end and may be hard to recover from.`,
        messagePt: `O ${label.pt} está programado para cerca de ${sets} séries/semana, um volume alto que pode ser difícil de recuperar.`,
      });
    }
  }

  // 2. Total working sets per session.
  for (const day of days) {
    const totalSets = day.exercises.reduce((sum, e) => sum + e.sets, 0);
    if (totalSets > HIGH_SESSION_WORKING_SETS_THRESHOLD) {
      feedback.push({
        code: `high-session-volume-day-${day.dayIndex}`,
        severity: "notice",
        messageEn: `"${day.nameEn}" has ${totalSets} working sets, which may be difficult to recover from in one session.`,
        messagePt: `"${day.namePt}" tem ${totalSets} séries de trabalho, o que pode ser difícil de recuperar em uma única sessão.`,
      });
    }
  }

  // 3. Duplicate/very similar movement patterns within a single day.
  for (const day of days) {
    const byPattern = new Map<string, ProgramRuleExercise[]>();
    for (const ex of day.exercises) {
      if (!ex.movementPattern) continue;
      const list = byPattern.get(ex.movementPattern) ?? [];
      list.push(ex);
      byPattern.set(ex.movementPattern, list);
    }
    for (const [pattern, exs] of byPattern) {
      if (exs.length >= SIMILAR_MOVEMENT_MIN_COUNT) {
        feedback.push({
          code: `similar-movements-day-${day.dayIndex}-${pattern}`,
          severity: "info",
          messageEn: `"${day.nameEn}" includes ${exs.length} very similar ${pattern.replace(/-/g, " ")} movements (${exs.map((e) => e.nameEn).join(", ")}).`,
          messagePt: `"${day.namePt}" inclui ${exs.length} movimentos muito parecidos do tipo ${pattern.replace(/-/g, " ")} (${exs.map((e) => e.namePt).join(", ")}).`,
        });
      }
    }
  }

  // 4. Consecutive lower-body-heavy sessions.
  const sortedDays = [...days].sort((a, b) => a.dayIndex - b.dayIndex);
  for (let i = 0; i < sortedDays.length - 1; i++) {
    if (isLowerBodyHeavy(sortedDays[i]) && isLowerBodyHeavy(sortedDays[i + 1])) {
      feedback.push({
        code: `consecutive-lower-body-${sortedDays[i].dayIndex}-${sortedDays[i + 1].dayIndex}`,
        severity: "notice",
        messageEn: `Heavy lower-body sessions ("${sortedDays[i].nameEn}" and "${sortedDays[i + 1].nameEn}") are scheduled on consecutive days.`,
        messagePt: `Sessões pesadas de perna ("${sortedDays[i].namePt}" e "${sortedDays[i + 1].namePt}") estão programadas em dias consecutivos.`,
      });
    }
  }

  // 5. No horizontal pull anywhere in the program.
  const hasHorizontalPull = days.some((d) => d.exercises.some((e) => e.movementPattern === "horizontal-pull"));
  const hasAnyPull = days.some((d) =>
    d.exercises.some((e) => e.movementPattern === "horizontal-pull" || e.movementPattern === "vertical-pull"),
  );
  if (!hasHorizontalPull && hasAnyPull) {
    feedback.push({
      code: "no-horizontal-pull",
      severity: "info",
      messageEn: "This program contains no horizontal pulling movement (e.g. a row).",
      messagePt: "Este programa não contém nenhum movimento de puxada horizontal (ex.: remada).",
    });
  }

  return feedback;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
