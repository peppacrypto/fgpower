/**
 * Deterministic "smart program feedback" (spec §12). No AI/LLM involved —
 * every rule here is a plain, explainable heuristic over the program
 * structure. Thresholds are documented, with their evidentiary basis, in
 * docs/PROGRAMMING_RULES.md. These are heuristics, not prohibitions: the
 * UI always frames them as guidance a user can ignore.
 */

import { MUSCLE_GROUP_LABEL, type MuscleGroupTag } from "@/lib/constants/muscle-groups";

export type { MuscleGroupTag };

/** pt-BR labels for movement-pattern ids, so the pt feedback never shows the
 * raw English slug (e.g. "horizontal push"). Lowercased for mid-sentence use. */
const MOVEMENT_PATTERN_PT: Record<string, string> = {
  squat: "agachamento",
  hinge: "dobradiça de quadril",
  lunge: "avanço",
  "horizontal-push": "empurrar horizontal",
  "vertical-push": "empurrar vertical",
  "horizontal-pull": "puxar horizontal",
  "vertical-pull": "puxar vertical",
  "hip-extension": "extensão de quadril",
  "knee-extension": "extensão de joelho",
  "knee-flexion": "flexão de joelho",
  "elbow-flexion": "flexão de cotovelo",
  "elbow-extension": "extensão de cotovelo",
  "shoulder-abduction": "abdução de ombro",
  "shoulder-extension": "extensão de ombro",
  "plantar-flexion": "flexão plantar",
  "trunk-flexion": "flexão de tronco",
  "anti-extension": "anti-extensão",
  "anti-rotation": "anti-rotação",
  rotation: "rotação",
  carry: "carregada",
  olympic: "levantamento olímpico",
};

function movementPatternPt(pattern: string): string {
  return MOVEMENT_PATTERN_PT[pattern] ?? pattern.replace(/-/g, " ");
}

export interface ProgramRuleMuscle {
  id: string;
  nameEn: string;
  namePt: string;
}

export interface ProgramRuleExercise {
  exerciseId: string;
  nameEn: string;
  namePt: string;
  primaryMuscleGroups: MuscleGroupTag[];
  /** Muscle-level targets. When every exercise carries them, weekly volume is judged per muscle (rule 1). */
  primaryMuscles?: ProgramRuleMuscle[];
  secondaryMuscles?: ProgramRuleMuscle[];
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
/** Credit for a set in which the muscle is a synergist rather than the prime mover (fractional counting). */
const SECONDARY_SET_CREDIT = 0.5;

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

interface MuscleVolume {
  muscle: ProgramRuleMuscle;
  direct: number;
  fractional: number;
}

function weeklySetsByMuscle(days: ProgramRuleDay[]): Map<string, MuscleVolume> {
  const totals = new Map<string, MuscleVolume>();
  const entry = (m: ProgramRuleMuscle) => {
    const existing = totals.get(m.id);
    if (existing) return existing;
    const created = { muscle: m, direct: 0, fractional: 0 };
    totals.set(m.id, created);
    return created;
  };
  for (const day of days) {
    for (const ex of day.exercises) {
      for (const m of ex.primaryMuscles ?? []) {
        const e = entry(m);
        e.direct += ex.sets;
        e.fractional += ex.sets;
      }
      for (const m of ex.secondaryMuscles ?? []) {
        if (ex.primaryMuscles?.some((p) => p.id === m.id)) continue;
        entry(m).fractional += ex.sets * SECONDARY_SET_CREDIT;
      }
    }
  }
  return totals;
}

function formatSets(n: number, locale: "en" | "pt"): string {
  const rounded = Math.round(n * 2) / 2;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return locale === "pt" ? text.replace(".", ",") : text;
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

  // 1. Weekly volume. With muscle-level data: per muscle — "high" on direct
  // sets, "low" on fractional sets (direct + half of the sets where the muscle
  // assists), so a muscle trained mostly through compounds is not called
  // under-trained and separate muscles are never summed into one group total.
  // Without it (legacy callers): per coarse muscle group, direct sets only.
  const hasMuscleData = days.every((d) => d.exercises.every((e) => Array.isArray(e.primaryMuscles)));
  if (hasMuscleData) {
    for (const { muscle, direct, fractional } of weeklySetsByMuscle(days).values()) {
      if (direct > 0 && fractional < LOW_WEEKLY_SETS_THRESHOLD) {
        feedback.push({
          code: `low-volume-${muscle.id}`,
          severity: "notice",
          messageEn: `${muscle.nameEn} gets about ${formatSets(fractional, "en")} sets/week, counting direct sets plus half of the sets where it assists. That may be low if hypertrophy for this muscle is a priority.`,
          messagePt: `${muscle.namePt}: cerca de ${formatSets(fractional, "pt")} séries/semana, contando as séries diretas e metade das séries em que ele auxilia. Pode ser pouco se a hipertrofia desse músculo for prioridade.`,
        });
      }
      if (direct > HIGH_WEEKLY_SETS_THRESHOLD) {
        feedback.push({
          code: `high-volume-${muscle.id}`,
          severity: "notice",
          messageEn: `${muscle.nameEn} is programmed for about ${formatSets(direct, "en")} direct sets/week, which is on the high end and may be hard to recover from.`,
          messagePt: `${muscle.namePt}: cerca de ${formatSets(direct, "pt")} séries diretas/semana, um volume alto que pode ser difícil de recuperar.`,
        });
      }
    }
  }
  const weekly = hasMuscleData ? new Map<MuscleGroupTag, number>() : weeklySetsByMuscleGroup(days);
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
          messagePt: `"${day.namePt}" inclui ${exs.length} movimentos muito parecidos do tipo ${movementPatternPt(pattern)} (${exs.map((e) => e.namePt).join(", ")}).`,
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
