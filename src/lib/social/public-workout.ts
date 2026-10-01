/**
 * What a shared workout shows to someone outside the app (/t/<token>, its OG
 * card and the story image) — built from the stored activity summary and
 * nothing else, and defensive about it: summaries stored by older versions
 * can still hold loads in prs[].value with the loads hidden, exercises with
 * no set done, or records repeated per kind. Pure and client-safe.
 */
import { describeRecord, groupRecordsByExercise, isShownPrKind, type RecordLike } from "@/lib/training/personal-records-core";
import { formatSet } from "@/lib/training/set-plan";
import { formatDuration, formatKg, formatNumber, plural } from "@/lib/utils/format";

export interface PublicWorkoutExercise {
  name: string;
  workingSets: number;
  /** The heaviest set — only with the loads shown. */
  bestSet: { weightKg: number; reps: number } | null;
  /** A hold (plank…): its reps are seconds. */
  timed: boolean;
}

export interface PublicWorkoutRecord {
  exerciseName: string;
  /** "carga 80 kg · 12 reps com 70 kg", a hold's "45 s", or the kinds' names with the loads hidden. */
  text: string;
}

export interface PublicWorkoutView {
  workoutName: string;
  durationSeconds: number | null;
  totalWorkingSets: number;
  /** Null with the loads hidden. */
  totalVolumeKg: number | null;
  exercises: PublicWorkoutExercise[];
  /** One entry per exercise with a record, in workout order. */
  records: PublicWorkoutRecord[];
  loadsShown: boolean;
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/**
 * The public view of a stored WORKOUT summary. With the loads hidden, no
 * load reaches the result: no volume, no best set, and records described by
 * their kind ("recorde de carga", "recorde de 12 reps").
 */
export function toPublicWorkoutView(summary: unknown, showDetailedLoads: boolean): PublicWorkoutView {
  const s = isObject(summary) ? summary : {};
  const exercises: PublicWorkoutExercise[] = (Array.isArray(s.exercises) ? s.exercises : []).flatMap((raw) => {
    if (!isObject(raw)) return [];
    const name = str(raw.name);
    const workingSets = num(raw.workingSets) ?? 0;
    if (!name || workingSets <= 0) return [];
    const best = isObject(raw.bestSet) ? raw.bestSet : null;
    const weightKg = best ? num(best.weightKg) : null;
    const reps = best ? num(best.reps) : null;
    return [
      {
        name,
        workingSets,
        bestSet: showDetailedLoads && weightKg != null && reps != null ? { weightKg, reps } : null,
        timed: raw.timed === true,
      },
    ];
  });

  // A hold's record: flagged on the record itself (prs[].timed), else by its exercise in this workout.
  const timedExercises = new Set(exercises.filter((e) => e.timed).map((e) => e.name));
  const prs = (Array.isArray(s.prs) ? s.prs : []).flatMap((raw) => {
    if (!isObject(raw)) return [];
    const exerciseName = str(raw.exerciseName);
    const kind = typeof raw.kind === "string" ? raw.kind : "";
    if (!exerciseName || !isShownPrKind(kind)) return [];
    const timed = raw.timed === true || timedExercises.has(exerciseName);
    return [{ exerciseName, kind, value: num(raw.value), weightKg: num(raw.weightKg), reps: num(raw.reps), timed }];
  });
  const order = exercises.map((e) => e.name);
  const records = groupRecordsByExercise(prs, (r) => r.exerciseName, order).flatMap((g) => {
    const texts = g.records.map((r) => describePublicRecord(r, !showDetailedLoads)).filter((t) => t !== null);
    // A hold whose only record is an e1RM has nothing to say.
    return texts.length > 0 ? [{ exerciseName: g.key, text: [...new Set(texts)].join(" · ") }] : [];
  });

  return {
    workoutName: str(s.workoutName) ?? "Treino",
    durationSeconds: num(s.durationSeconds),
    totalWorkingSets: num(s.totalWorkingSets) ?? exercises.reduce((n, e) => n + e.workingSets, 0),
    totalVolumeKg: showDetailedLoads ? num(s.totalVolumeKg) : null,
    exercises,
    records,
    loadsShown: showDetailedLoads,
  };
}

/**
 * One record as short text. A hold's numbers are seconds (L-bodyweight-timed-
 * display): "45 s" (bodyweight), "40 s com 10 kg", "recorde de 40 s" with the
 * loads hidden — and it never lists an e1RM, which means nothing for a hold
 * (null: left out). Everything else as describeRecord says it.
 */
function describePublicRecord(r: RecordLike & { timed: boolean }, hideLoads: boolean): string | null {
  if (!r.timed) return describeRecord(r, hideLoads);
  switch (r.kind) {
    case "MAX_REPS_AT_WEIGHT": {
      const seconds = r.reps ?? r.value;
      if (seconds == null) return "recorde de tempo";
      const time = `${formatNumber(seconds, 0)} s`;
      if (r.weightKg === 0) return time;
      if (hideLoads || r.weightKg == null) return `recorde de ${time}`;
      return `${time} com ${formatKg(r.weightKg)}`;
    }
    case "ESTIMATED_1RM":
      return null;
    default:
      return describeRecord(r, hideLoads);
  }
}

/** "4 séries · 80 kg × 8" (the best set only with the loads shown). */
export function exerciseLine(e: PublicWorkoutExercise): string {
  const sets = plural(e.workingSets, "série", "séries");
  return e.bestSet ? `${sets} · ${formatSet(e.bestSet.weightKg, e.bestSet.reps, { timed: e.timed })}` : sets;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "28 set 2026" — the São Paulo calendar day. */
export function formatShareDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return `${get("day")} ${MONTHS[get("month") - 1]} ${get("year")}`;
}

/** A session volume in few characters: "12,4 t" from a tonne up, else "850 kg". */
export function compactVolume(kg: number): string {
  if (kg >= 1000) return `${formatNumber(Math.round(kg / 100) / 10, 1)} t`;
  return `${formatNumber(Math.round(kg), 0)} kg`;
}

/**
 * The story's stat strip: the first three of Duração, Séries, Volume (only
 * with the loads shown) and Exercícios.
 */
export function storyStats(view: PublicWorkoutView, durationSeconds: number | null): { label: string; value: string }[] {
  const stats: { label: string; value: string }[] = [];
  const duration = durationSeconds ?? view.durationSeconds;
  if (duration) stats.push({ label: "Duração", value: formatDuration(duration) });
  stats.push({ label: "Séries", value: formatNumber(view.totalWorkingSets, 0) });
  if (view.loadsShown && view.totalVolumeKg) stats.push({ label: "Volume", value: compactVolume(view.totalVolumeKg) });
  stats.push({ label: "Exercícios", value: formatNumber(view.exercises.length, 0) });
  return stats.slice(0, 3);
}

/**
 * The one-line stats a page or a preview says: "58 min · 18 séries de
 * trabalho · 12.400 kg de volume" (the volume only with the loads shown).
 */
export function statsLine(view: PublicWorkoutView, durationSeconds: number | null): string {
  const duration = durationSeconds ?? view.durationSeconds;
  return [
    duration ? formatDuration(duration) : null,
    plural(view.totalWorkingSets, "série de trabalho", "séries de trabalho"),
    view.loadsShown && view.totalVolumeKg ? `${formatNumber(Math.round(view.totalVolumeKg), 0)} kg de volume` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Text for an image render without emoji (and other pictographs): Satori
 * would fetch their glyphs from a CDN at render time. Collapses the spaces
 * they leave behind.
 */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Cuts text to `max` characters, ending on "…". */
export function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}
