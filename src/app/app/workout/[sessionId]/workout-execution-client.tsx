"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, Info, Pencil, Plus, SkipForward, Undo2, X } from "lucide-react";
import { GLoad, GNotes, GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  addExerciseToWorkout,
  addExtraSet,
  discardWorkoutSession,
  finishStaleWorkoutSessionAndOpen,
  finishWorkoutSession,
  removeSet,
  skipExercise,
  swapExercise,
  type ExerciseChangeResult,
  type LogSetInput,
  type SetSyncOp,
  type SetSyncResult,
} from "@/lib/actions/workouts";
import { saveExerciseNote } from "@/lib/actions/exercise-notes";
import {
  firstTimeReps,
  formatDecimal,
  formatSet,
  isExerciseDone,
  parseDecimalInput,
  planRows,
  suggestFor,
  warmupSuggestions,
  type SuggestContext,
  type SuggestedValues,
} from "@/lib/training/set-plan";
import { formatKg, formatRir, plural } from "@/lib/utils/format";
import {
  DRAFTS_KEY_PREFIX,
  REST_KEY_PREFIX,
  SUGGESTIONS_LEARNED_AFTER,
  WORKOUT_PREF,
  devicePrefsFrom,
  draftsKey,
  mirrorWorkoutPrefs,
  readWorkoutPref,
  restKey,
  writeWorkoutPref,
  type WorkoutDevicePrefs,
} from "@/components/workout/local-workout";
import { FIELD_LABEL, SetTable, fieldLabel, rowName, type DraftField, type SetTableRowModel } from "./set-table";
import { RirSheet, rirSpareWords } from "./rir-sheet";
import { FinishSheet, type FinishStats } from "./finish-sheet";
import { RestTimerBar, clearStoredRestTimer, useRestTimer } from "./rest-timer";
import { unlockRestAudio } from "./rest-audio";
import { useWakeLock } from "./use-wake-lock";
import { rememberLimitationsEcho } from "./limitations-bone";
import { recordRows } from "./pr-moment";
import { ExerciseSwapSheet, type SwapSheetMode } from "./exercise-swap-sheet";
import { TechniqueSheet } from "./technique-sheet";
import { markWorkoutVisited, readShownExercise, rememberShownExercise } from "./workout-visit";
import type { ExecutionExerciseLog, ExecutionSession, ExecutionSetLog } from "./types";
import type { ExerciseOption } from "@/lib/data/workout-session";

type RowValues = Record<DraftField, string>;
/**
 * The screen's own copy of a row: what the user typed and whether it is ✓'d.
 * The screen owns this state — set writes don't re-render the page — and
 * sends it through an outbox (/api/workout/sets) that retries until the
 * server has it.
 *
 * `dirty` = not yet confirmed by the server: resent (outbox, finish),
 * mirrored locally and restored after a reload. A confirmed draft stays in
 * force while the data on screen is older than its confirmation (`savedAt`
 * vs the session's `loadedAtMs` — e.g. a page restored from the back/forward
 * cache); once fresher server data arrives, the server copy wins, so a
 * correction made on another device shows up here instead of being
 * overwritten from here.
 */
interface Draft {
  /** Typed values; untouched fields show the saved value. */
  values: Partial<RowValues>;
  /** Local ✓ state; undefined = the server's. */
  done?: boolean;
  /** When ✓ was tapped: a ✓ that reaches the server late keeps its own time. */
  doneAt?: number;
  dirty: boolean;
  /** Server time the write was confirmed. */
  savedAt: number | null;
  /** Bumped on every local change: a confirmation only settles the revision it was sent with. */
  rev: number;
}
type Drafts = Record<string, Draft>;
type StoredDraft = Omit<Draft, "rev">;

const FIELDS: DraftField[] = ["weight", "reps", "rir"];
const RETRY_MIN_MS = 4000;
const RETRY_MAX_MS = 30_000;
const SEND_TIMEOUT_MS = 12_000;

let revCounter = 0;
const nextRev = () => ++revCounter;

function formatRest(seconds: number) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds}s`;
}

/** The header clock, isolated so its per-second tick doesn't re-render the whole screen. */
function ElapsedClock({ startedAtIso }: { startedAtIso: string }) {
  const [elapsed, setElapsed] = useState<number | null>(null);
  useEffect(() => {
    const start = new Date(startedAtIso).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAtIso]);
  if (elapsed === null) return <span className="tabular-nums">0:00</span>;
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const text = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return <span className="tabular-nums">{text}</span>;
}

// Drafts are mirrored locally so a reload, a dead tab or a lost connection
// never costs what the user already entered or ✓'d.
const storageKey = draftsKey;

function cleanStoredValues(v: unknown): Partial<RowValues> {
  const out: Partial<RowValues> = {};
  if (v && typeof v === "object") {
    for (const f of FIELDS) {
      const x = (v as Record<string, unknown>)[f];
      if (typeof x === "string") out[f] = x.slice(0, 20);
    }
  }
  return out;
}

function readStoredDrafts(sessionId: string): Record<string, StoredDraft> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(sessionId)) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, StoredDraft> = {};
    const p = parsed as { v?: unknown; rows?: unknown };
    if (p.v === 2 && p.rows && typeof p.rows === "object") {
      for (const [id, raw] of Object.entries(p.rows as Record<string, Record<string, unknown>>)) {
        if (!raw || typeof raw !== "object") continue;
        out[id] = {
          values: cleanStoredValues(raw.values),
          done: typeof raw.done === "boolean" ? raw.done : undefined,
          doneAt: typeof raw.doneAt === "number" ? raw.doneAt : undefined,
          dirty: raw.dirty === true,
          savedAt: typeof raw.savedAt === "number" ? raw.savedAt : null,
        };
      }
    } else {
      // First version: only the unconfirmed typed values.
      for (const [id, values] of Object.entries(parsed as Record<string, unknown>)) {
        out[id] = { values: cleanStoredValues(values), dirty: true, savedAt: null };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Mirrors what the server doesn't have yet, and confirmed rows newer than the data on screen. */
function writeStoredDrafts(sessionId: string, drafts: Drafts, loadedAtMs: number) {
  try {
    const rows: Record<string, StoredDraft> = {};
    for (const [id, d] of Object.entries(drafts)) {
      if (!d.dirty && !(d.savedAt !== null && d.savedAt > loadedAtMs)) continue;
      rows[id] = { values: d.values, done: d.done, doneAt: d.doneAt, dirty: d.dirty, savedAt: d.savedAt };
    }
    if (Object.keys(rows).length === 0) window.localStorage.removeItem(storageKey(sessionId));
    else window.localStorage.setItem(storageKey(sessionId), JSON.stringify({ v: 2, rows }));
  } catch {
    /* storage unavailable (private mode) — drafts still live in memory */
  }
}

function clearStoredDrafts(sessionId: string) {
  try {
    window.localStorage.removeItem(storageKey(sessionId));
  } catch {
    /* ignore */
  }
}

/**
 * Drops what other workouts left on this device once they can't need it: their
 * rest timers, and draft mirrors holding nothing unsent (a workout finished on
 * another device or closed from Today). A mirror with unsent rows is kept —
 * only its own workout screen can send them.
 */
function pruneOtherWorkouts(sessionId: string) {
  try {
    const ls = window.localStorage;
    const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => k !== null);
    for (const key of keys) {
      if (key.startsWith(REST_KEY_PREFIX) && key !== restKey(sessionId)) {
        ls.removeItem(key);
      } else if (key.startsWith(DRAFTS_KEY_PREFIX) && key !== storageKey(sessionId)) {
        const other = key.slice(DRAFTS_KEY_PREFIX.length);
        if (!Object.values(readStoredDrafts(other)).some((d) => d.dirty)) ls.removeItem(key);
      }
    }
  } catch {
    /* storage unavailable — nothing was kept */
  }
}

function inForce(d: Draft | undefined, current: ExecutionSession): d is Draft {
  return d !== undefined && (d.dirty || (d.savedAt !== null && d.savedAt > current.loadedAtMs));
}
function savedValues(set: ExecutionSetLog): RowValues {
  return { weight: formatDecimal(set.weightKg), reps: formatDecimal(set.reps), rir: formatDecimal(set.rir) };
}
function shownValues(set: ExecutionSetLog, drafts: Drafts, current: ExecutionSession): RowValues {
  const base = savedValues(set);
  const d = drafts[set.id];
  return inForce(d, current)
    ? { weight: d.values.weight ?? base.weight, reps: d.values.reps ?? base.reps, rir: d.values.rir ?? base.rir }
    : base;
}
function shownDone(set: ExecutionSetLog, drafts: Drafts, current: ExecutionSession): boolean {
  const d = drafts[set.id];
  return inForce(d, current) && d.done !== undefined ? d.done : set.isCompleted;
}
/**
 * A row's numbers. On a bodyweight exercise an empty kg box is no extra load
 * (0 kg) once the reps are there: the set counts with the reps alone.
 */
function parseRow(v: RowValues, bodyweight = false) {
  const reps = parseDecimalInput(v.reps);
  const weightKg = parseDecimalInput(v.weight) ?? (bodyweight && reps !== null ? 0 : null);
  return { weightKg, reps, rir: parseDecimalInput(v.rir) };
}
function isFilled(v: RowValues, bodyweight = false) {
  const p = parseRow(v, bodyweight);
  return p.weightKg !== null && p.reps !== null && p.reps >= 1;
}

type SyncState = Record<string, "sending" | "failed">;

/** The login expired: resending won't help until the user signs in again. */
class LoggedOutError extends Error {}

/** One batch to the outbox route; rejects on network errors, timeouts and non-2xx (LoggedOutError on 401). */
async function postSets(ops: SetSyncOp[]): Promise<{ results: SetSyncResult[]; savedAtMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch("/api/workout/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops }),
      signal: controller.signal,
    });
    if (res.status === 401) throw new LoggedOutError("UNAUTHORIZED");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { results: SetSyncResult[]; savedAtMs: number };
  } finally {
    clearTimeout(timeout);
  }
}

function focusedRowId() {
  return document.activeElement?.closest?.("[data-set-row]")?.getAttribute("data-set-row") ?? null;
}

interface ExerciseRows {
  warmups: SetTableRowModel[];
  prescribed: SetTableRowModel[];
  extras: SetTableRowModel[];
}

function buildRows(
  ex: ExecutionExerciseLog,
  drafts: Drafts,
  current: ExecutionSession,
  sync: SyncState,
  errors: Record<string, string>,
  loggedOut: boolean,
): ExerciseRows {
  const plan = planRows(ex.sets);
  const ctx: SuggestContext = {
    previous: ex.previousSets,
    target: ex.advice ? { kind: ex.advice.kind, loadKg: ex.advice.loadKg, targetReps: ex.advice.targetReps } : null,
    prescribedReps: firstTimeReps(ex.repMin, ex.repMax),
    bodyweight: ex.bodyweight,
  };
  // A typed load far from last time's that isn't ✓'d yet ("225" for 22,5) is
  // kept out of the grey loads below it and the warm-up ramp (W-088): a ✓ on
  // an empty box would otherwise log the typo unasked. Once ✓'d, it counts.
  const lastTop = Math.max(0, ...ex.previousSets.map((s) => s.weightKg ?? 0));
  const carries = (kg: number, done: boolean) =>
    done || kg <= 0 || lastTop === 0 || (kg <= lastTop * LOAD_JUMP_UP && kg >= lastTop * LOAD_JUMP_DOWN);
  let above: SuggestedValues | null = null;
  const toModel = (r: (typeof plan.prescribed)[number], given?: SuggestedValues): SetTableRowModel => {
    const values = shownValues(r.set, drafts, current);
    const suggestion = given ?? suggestFor(r.kind, r.ordinal, above, ctx);
    const p = parseRow(values, ex.bodyweight);
    const isDone = shownDone(r.set, drafts, current);
    if (r.kind !== "WARMUP" && p.weightKg !== null && carries(p.weightKg, isDone)) {
      above = { weightKg: p.weightKg, reps: p.reps ?? suggestion.reps };
    }
    const hasW = values.weight.trim() !== "";
    const hasR = values.reps.trim() !== "";
    const unsent = drafts[r.set.id]?.dirty === true;
    return {
      id: r.set.id,
      kind: r.kind,
      ordinal: r.ordinal,
      values,
      suggestion,
      done: isDone,
      // Every unconfirmed row reads as on its way — also one queued behind a
      // batch in flight — until the server confirms it or a send fails.
      sync: !unsent ? null : sync[r.set.id] !== "failed" ? "sending" : loggedOut ? "held" : "pending",
      error: errors[r.set.id] ?? null,
      // Bodyweight: reps without kg is a whole set (no extra load).
      missing:
        !isDone && !ex.wasSkipped && hasW !== hasR && !(ex.bodyweight && hasR) ? (hasW ? "reps" : "weight") : null,
    };
  };
  const prescribed = plan.prescribed.map((r) => toModel(r));
  const extras = plan.extras.map((r) => toModel(r));
  // The ✓'d sets that beat a record (pr-moment): the summary's rules, in the order done.
  const records = recordRows(ex.recordBars, workingRowsForRecords([...prescribed, ...extras]));
  for (const r of [...prescribed, ...extras]) if (records.has(r.id)) r.record = true;
  // Warm-ups ramp up to the first working set: what is typed there, else its grey load.
  const first = prescribed[0];
  const typedFirst = first ? parseDecimalInput(first.values.weight) : null;
  const workingLoad = first
    ? typedFirst !== null && carries(typedFirst, first.done)
      ? typedFirst
      : first.suggestion.weightKg
    : null;
  const ramp = warmupSuggestions(plan.warmups.length, workingLoad, ex.loadIncrementKg);
  return {
    warmups: plan.warmups.map((r, i) => toModel(r, ramp[i])),
    prescribed,
    extras,
  };
}

/** ✓'d working rows as pr-moment reads them (loads/reps as shown). */
function workingRowsForRecords(rows: SetTableRowModel[]) {
  return rows
    .filter((r) => r.done)
    .map((r) => ({ id: r.id, weightKg: parseDecimalInput(r.values.weight), reps: parseDecimalInput(r.values.reps) }));
}

/** A load this far from the reference is asked about before it counts ("225 kg? Último: 22,5 kg"). */
const LOAD_JUMP_UP = 1.5;
const LOAD_JUMP_DOWN = 0.5;

/**
 * What a typed load is checked against (W-088): last time's heaviest working
 * set, or — a first time — the first other ✓'d working set of this exercise
 * today. Null when there is nothing to compare with.
 */
function loadReference(ex: ExecutionExerciseLog, rows: ExerciseRows, rowId: string): { kg: number; label: string } | null {
  const last = Math.max(0, ...ex.previousSets.map((s) => s.weightKg ?? 0));
  if (last > 0) return { kg: last, label: "Último" };
  for (const r of [...rows.prescribed, ...rows.extras]) {
    if (r.id === rowId || !r.done) continue;
    const kg = parseDecimalInput(r.values.weight);
    if (kg !== null && kg > 0) return { kg, label: rowName(r) };
  }
  return null;
}

/**
 * A typed load this far from the reference ("225" for 22,5): the question to
 * ask ("225 kg? Último: 22,5 kg") — null when it is close enough, there is
 * nothing to compare with, or this row's number was already confirmed.
 */
function loadJump(
  ex: ExecutionExerciseLog,
  rows: ExerciseRows,
  rowId: string,
  kg: number | null,
  confirmed: Record<string, number>,
): { kg: number; text: string } | null {
  if (kg === null || kg <= 0 || confirmed[rowId] === kg) return null;
  const ref = loadReference(ex, rows, rowId);
  if (!ref || (kg <= ref.kg * LOAD_JUMP_UP && kg >= ref.kg * LOAD_JUMP_DOWN)) return null;
  return { kg, text: `${formatKg(kg)}? ${ref.label}: ${formatKg(ref.kg)}` };
}

function rowsComplete(rows: ExerciseRows, skipped: boolean) {
  if (skipped) return true;
  if (rows.prescribed.length > 0) return rows.prescribed.every((r) => r.done);
  return rows.extras.some((r) => r.done);
}

/**
 * "Série 3 · 60 kg × 10" — "Série 3 · 12 reps" / "Série 3 · 45 s" without
 * extra load: the next set to do in an exercise, with the numbers to aim for.
 */
function upNextText(rows: ExerciseRows, ex: Pick<ExecutionExerciseLog, "timed">): string | null {
  const row = [...rows.prescribed, ...rows.extras].find((r) => !r.done);
  if (!row) return null;
  const kg = parseDecimalInput(row.values.weight) ?? row.suggestion.weightKg;
  const reps = parseDecimalInput(row.values.reps) ?? row.suggestion.reps;
  if (kg === null || reps === null) return rowName(row);
  const n = Math.round(reps);
  const aim = kg === 0 && !ex.timed ? plural(n, "rep", "reps") : formatSet(kg, n, { timed: ex.timed });
  return `${rowName(row)} · ${aim}`;
}

/**
 * Last time's sets in one line when they share a load ("40 kg × 12 · 12 · 11";
 * without extra load "× 12 · 12 · 11", a hold "45 · 40 · 35 s"; RIR
 * "3 · 2 · 2"); null when loads differ or extras were done — then each set is
 * listed.
 */
function sameLoadSummary(sets: ExecutionExerciseLog["previousSets"], timed: boolean) {
  if (sets.length < 2 || sets.some((s) => s.isExtra || s.weightKg === null || s.weightKg !== sets[0].weightKg)) return null;
  const rirs = sets.map((s) => s.rir);
  const reps = `${sets.map((s) => s.reps ?? "—").join(" · ")}${timed ? "\u00a0s" : ""}`;
  return {
    text: sets[0].weightKg === 0 ? (timed ? reps : `×\u00a0${reps}`) : `${formatKg(sets[0].weightKg)} × ${reps}`,
    rir: rirs.every((r) => r === null) ? null : rirs.map((r) => (r === null ? "–" : formatDecimal(r))).join(" · "),
  };
}

/** Program notes longer than this are folded to two lines ("Ler tudo"). */
const LONG_NOTE_CHARS = 110;

/** A ✓ that used the grey suggestions; after a few, their explanation folds into an (i). */
function countSuggestionUsed() {
  const n = Number(readWorkoutPref(WORKOUT_PREF.suggestionsUsed)) || 0;
  if (n < SUGGESTIONS_LEARNED_AFTER) writeWorkoutPref(WORKOUT_PREF.suggestionsUsed, String(n + 1));
}

/** A Next.js navigation thrown through an action (the finish's redirect to the summary). */
function isNavigation(err: unknown) {
  try {
    unstable_rethrow(err);
    return false;
  } catch {
    return true;
  }
}

type NoteStatus = { state: "saving" | "saved" | "error"; text: string };

/** Longer than this, the "Você informou" text is folded to two lines (tap to read it all). */
const LONG_LIMITATIONS_CHARS = 70;

/**
 * What the user wrote about injuries at onboarding, echoed on their first
 * workouts with the way out (Pular exercício / a professional). `full` shows
 * it with that line (the text folded to two lines when long); `line` is a
 * one-line reminder that opens it. Closing it hides it for the whole workout.
 */
function LimitationsEcho({
  text,
  mode,
  open,
  onToggle,
  onClose,
}: {
  text: string;
  mode: "full" | "line";
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const tag = (
    <span className="mr-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-warning">Você informou</span>
  );
  const closeButton = (
    <button
      type="button"
      aria-label="Fechar o que você informou"
      onClick={onClose}
      className="flex size-9 shrink-0 items-center justify-center text-muted hover:text-foreground"
    >
      <X className="size-4" />
    </button>
  );
  if (mode === "line" && !open) {
    return (
      <div data-limitations className="mb-3 flex items-center border-l-2 border-l-warning! bg-warning-soft pl-3 text-xs">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          className="flex min-h-9 min-w-0 flex-1 items-center text-left"
        >
          {tag}
          <span className="min-w-0 flex-1 truncate text-foreground/90">“{text}”</span>
          <ChevronDown aria-hidden className="ml-1 size-3.5 shrink-0 text-warning" />
          <span className="sr-only">Ler tudo</span>
        </button>
        {closeButton}
      </div>
    );
  }
  // Opened from the one-line reminder, it folds back the same way.
  const foldable = mode === "line" || text.length > LONG_LIMITATIONS_CHARS;
  const quote = (
    <span className={cn("block text-foreground wrap-break-word", foldable && !open && "line-clamp-2")}>
      {tag}“{text}”
    </span>
  );
  return (
    <div data-limitations className="mb-3 flex items-start border-l-2 border-l-warning! bg-warning-soft pl-3 text-xs">
      <div className="min-w-0 flex-1 py-1.5">
        {foldable ? (
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-1 text-left">
            <span className="min-w-0 flex-1">{quote}</span>
            <ChevronDown
              aria-hidden
              className={cn("mt-0.5 size-3.5 shrink-0 text-warning transition-transform", open && "rotate-180")}
            />
            <span className="sr-only">{open ? "Mostrar menos" : "Ler tudo"}</span>
          </button>
        ) : (
          quote
        )}
        <p className="mt-0.5 text-foreground/80">
          Se incomodar, use <span className="font-semibold">Pular exercício</span> ou fale com um profissional.
        </p>
      </div>
      {closeButton}
    </div>
  );
}

export function WorkoutExecutionClient({
  session,
  devicePrefs,
  initialExerciseLogId = null,
}: {
  session: ExecutionSession;
  /** This device's prefs as the page read them (cookie mirror of local-workout prefs). */
  devicePrefs: WorkoutDevicePrefs;
  /** The exercise on screen when the page was left (?ex=): back from "Ver página completa", a reload. */
  initialExerciseLogId?: string | null;
}) {
  const router = useRouter();
  const total = session.exercises.length;
  const [exerciseIndex, setExerciseIndex] = useState(() => {
    const kept = initialExerciseLogId ? session.exercises.findIndex((ex) => ex.id === initialExerciseLogId) : -1;
    if (kept >= 0) return kept;
    // Reopening a workout lands on the first exercise still to do.
    const i = session.exercises.findIndex((ex) => !isExerciseDone(ex.sets, ex.wasSkipped));
    return i >= 0 ? i : Math.max(0, total - 1);
  });
  const [drafts, setDrafts] = useState<Drafts>({});
  const [sync, setSync] = useState<SyncState>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteStatus, setNoteStatus] = useState<Record<string, NoteStatus>>({});
  const [addingExtra, setAddingExtra] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showNotice, setShowNotice] = useState(session.notice !== null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishingNow, startFinishing] = useTransition();
  /** The finish went through: the summary is on its way (the sheet stays busy until it shows). */
  const [leaving, setLeaving] = useState(false);
  const finishing = finishingNow || leaving;
  const [finishMode, setFinishMode] = useState<"now" | "stale">("now");
  const [discarding, startDiscarding] = useTransition();
  const [, startTransition] = useTransition();
  const [announcement, setAnnouncement] = useState({ text: "", n: 0 });
  /** A send got 401: rows wait for a new login instead of retrying on a timer. */
  const [loggedOut, setLoggedOut] = useState(false);
  /** Anything typed or ✓'d on this screen since it loaded (a workout left open is being continued). */
  const [touched, setTouched] = useState(false);
  /** Set when a background action hit a stale build; the next explicit action reloads. */
  const staleBuild = useRef(false);
  /** A box to bring into view after the next render ("Revisar" in the finish sheet). */
  const pendingFocus = useRef<string | null>(null);
  /** Bring the exercise's next step into view after the next render (its last set was just ✓'d). */
  const revealCta = useRef(false);
  /**
   * A row whose load question (W-088) ✓ just raised: brought into view after
   * the next render. The question opens below the row — under the fixed rest
   * bar when the row sits just above it — and ✓ would look like it did nothing.
   */
  const revealRow = useRef<string | null>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const lastToggle = useRef<Record<string, number>>({});
  const savedNotes = useRef<Record<string, string>>({});
  const [sheetKey, setSheetKey] = useState(0);
  const [rirSheetOpen, setRirSheetOpen] = useState(false);
  /**
   * The grey suggestions were used a few times: their explanation folds into
   * an (i). Read on load and on each exercise change — never mid-exercise, so
   * the rows don't move under the finger. Like the other per-device prefs, it
   * starts as the page read it from this device's cookie.
   */
  const [suggestionsLearned, setSuggestionsLearned] = useState(devicePrefs.suggestionsLearned);
  const [hintOpen, setHintOpen] = useState(false);
  const [warmupsOpen, setWarmupsOpen] = useState(devicePrefs.warmupsOpen);
  const [limitationsClosed, setLimitationsClosed] = useState(devicePrefs.limitationsClosed);
  /** The "Você informou" note read in full (it is folded to two lines / one line). */
  const [limitationsOpen, setLimitationsOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  /** The week's instructions (W-054), opened from the header chip. */
  const [weekOpen, setWeekOpen] = useState(false);
  /** The chip's week line: "Sem. 5 · alvo RIR 1", "Sem. 13 · teste". */
  const weekChip = session.week
    ? `${session.week.label}${
        session.week.test
          ? " · teste"
          : session.week.deload
            ? " · deload"
            : session.week.rirTarget != null
              ? ` · alvo ${formatRir(session.week.rirTarget)}`
              : ""
      }`
    : "";
  /** The row whose "PR" was just earned (W-122): its mark pops in once. */
  const [prFlash, setPrFlash] = useState<{ id: string; n: number } | null>(null);
  /** "Trocar" / "Adicionar exercício" (W-006): the open sheet, the pick being saved and its failure. */
  const [swapSheet, setSwapSheet] = useState<SwapSheetMode | null>(null);
  const [swapBusy, setSwapBusy] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  /** The exercise to show once the page's fresh data has it (a pick added after the current one). */
  const pendingExercise = useRef<string | null>(null);
  /** The technique sheet (W-025) is open over the workout. */
  const [techniqueOpen, setTechniqueOpen] = useState(false);
  /**
   * A load far from the reference, waiting to be confirmed (W-088): asked on
   * ✓ (`toggle`: "Está certo" then ✓'s the row) or on leaving the row with it
   * typed (then "Está certo" only confirms the number).
   */
  const [loadCheck, setLoadCheck] = useState<{ id: string; text: string; kg: number; toggle: boolean } | null>(null);
  /**
   * Loads already confirmed per row: never asked twice for the same number.
   * The ref serves the ✓ right after "Está certo"; the state, the finish sheet.
   */
  const confirmedLoads = useRef<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  /** The exercise's name takes focus after an exercise change (W-161). */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const rest = useRestTimer(session.id);
  useWakeLock();

  const setById = useMemo(() => {
    const map = new Map<string, { set: ExecutionSetLog; ex: ExecutionExerciseLog; index: number }>();
    session.exercises.forEach((ex, index) => {
      for (const s of ex.sets) map.set(s.id, { set: s, ex, index });
    });
    return map;
  }, [session.exercises]);

  // The outbox runs from timers and network callbacks: it reads the latest
  // drafts and session through refs, never a render's stale closure.
  const draftsRef = useRef<Drafts>({});
  const sessionRef = useRef(session);
  const setByIdRef = useRef(setById);
  /** The local mirror was read back: from then on it may be rewritten. */
  const restored = useRef(false);
  useEffect(() => {
    sessionRef.current = session;
    setByIdRef.current = setById;
    // Fresh server data may already hold rows the mirror kept: drop those.
    if (restored.current) writeStoredDrafts(session.id, draftsRef.current, session.loadedAtMs);
  }, [session, setById]);

  function updateDrafts(fn: (d: Drafts) => Drafts) {
    const next = fn(draftsRef.current);
    if (next === draftsRef.current) return;
    draftsRef.current = next;
    setDrafts(next);
    if (restored.current) writeStoredDrafts(sessionRef.current.id, next, sessionRef.current.loadedAtMs);
  }

  const rowsByExercise = useMemo(
    () => session.exercises.map((ex) => buildRows(ex, drafts, session, sync, rowErrors, loggedOut)),
    [session, drafts, sync, rowErrors, loggedOut],
  );

  const exercise = session.exercises[exerciseIndex];
  const rows = rowsByExercise[exerciseIndex];

  useEffect(() => {
    // A new exercise on screen: screen-reader and keyboard focus go to its name (not left at the bottom).
    if (focusHeading.current) {
      focusHeading.current = false;
      headingRef.current?.focus({ preventScroll: true });
    }
    const label = pendingFocus.current;
    if (label) {
      pendingFocus.current = null;
      const el = Array.from(document.querySelectorAll<HTMLInputElement>("input[aria-label]")).find(
        (input) => input.getAttribute("aria-label") === label,
      );
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
    }
    if (revealCta.current) {
      revealCta.current = false;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ctaRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
    if (revealRow.current) {
      const row = document.querySelector<HTMLElement>(`[data-set-row="${revealRow.current}"]`);
      revealRow.current = null;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // "nearest": a row already clear of the bottom (its scroll margin clears the rest bar) doesn't move.
      row?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    }
  });

  useEffect(() => {
    if (!confirmSkip) return;
    const t = setTimeout(() => setConfirmSkip(false), 4000);
    return () => clearTimeout(t);
  }, [confirmSkip]);

  // This visit has a workout open: Today no longer sends it back here (W-097).
  // Back on this workout (a back step from the technique page, a reload,
  // Today's "Continuar"): the exercise that was on screen in this visit —
  // before the first paint of a client-side return. A link's ?ex= is the
  // fallback (a new tab, blocked storage).
  useLayoutEffect(() => {
    markWorkoutVisited();
    const kept = readShownExercise(session.id);
    const i = kept ? session.exercises.findIndex((ex) => ex.id === kept) : -1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after hydration
    if (i >= 0) setExerciseIndex(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per screen
  }, [session.id]);

  // A pick added after the current exercise shows once the page's fresh data has it.
  useEffect(() => {
    const id = pendingExercise.current;
    if (!id) return;
    const i = session.exercises.findIndex((ex) => ex.id === id);
    if (i < 0) return;
    pendingExercise.current = null;
    focusHeading.current = true;
    rememberShownExercise(session.id, id);
    setExerciseIndex(i);
  }, [session.id, session.exercises]);

  /**
   * A new build was deployed mid-workout: reload to pick it up. Drafts are
   * already mirrored to localStorage and restored.
   */
  function recoverFromStaleBuild(err: unknown) {
    if (unstable_isUnrecognizedActionError(err)) {
      window.location.reload();
      return true;
    }
    return false;
  }

  function refreshIfOnline() {
    // Offline, a failed refresh would fall back to a full page load.
    if (navigator.onLine) router.refresh();
  }

  function announce(text: string) {
    setAnnouncement((a) => ({ text, n: a.n + 1 }));
  }

  function setRowError(id: string, message: string | null) {
    setRowErrors((e) => {
      if (!message && !(id in e)) return e;
      const next = { ...e };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Outbox: every unconfirmed row goes to the server in one batch at a time
  // (so writes to a row can't overtake each other). A batch that fails leaves
  // its rows "pending" — kept here and in the local mirror — and is retried by
  // itself: on reconnect, when the app comes back to the screen, after the
  // next save that gets through, and on a backoff timer.
  // ---------------------------------------------------------------------------
  const inFlight = useRef(false);
  const flushAgain = useRef(false);
  /**
   * False once the screen is gone: its last send still goes out, but only a
   * mounted screen settles results and retries — a later screen for the same
   * workout restores the mirror and takes over.
   */
  const alive = useRef(true);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryDelay = useRef(RETRY_MIN_MS);

  /** The rows to send. `all` includes a ✓'d row whose boxes are being retyped (held while focused). */
  function buildOps(all: boolean): { ops: SetSyncOp[]; revs: Record<string, number> } {
    const current = sessionRef.current;
    const d = draftsRef.current;
    const focused = all ? null : focusedRowId();
    const ops: SetSyncOp[] = [];
    const revs: Record<string, number> = {};
    for (const [id, draft] of Object.entries(d)) {
      if (!draft.dirty) continue;
      const entry = setByIdRef.current.get(id);
      if (!entry) continue;
      const values = shownValues(entry.set, d, current);
      const bodyweight = entry.ex.bodyweight;
      const filled = isFilled(values, bodyweight);
      // Don't un-count a ✓'d set under the user's fingers while they retype it.
      if (id === focused && shownDone(entry.set, d, current) && !filled) continue;
      let done = draft.done ?? null;
      if (done === true && !filled) done = false;
      ops.push({
        setLogId: id,
        ...parseRow(values, bodyweight),
        done,
        completedAtMs: done === true ? (draft.doneAt ?? null) : null,
      });
      revs[id] = draft.rev;
    }
    return { ops, revs };
  }

  function scheduleRetry() {
    clearTimeout(retryTimer.current);
    const delay = retryDelay.current;
    retryDelay.current = Math.min(RETRY_MAX_MS, delay * 2);
    retryTimer.current = setTimeout(() => flush(), delay);
  }

  function flush() {
    clearTimeout(typingTimer.current);
    if (inFlight.current) {
      flushAgain.current = true;
      return;
    }
    const { ops, revs } = buildOps(false);
    if (ops.length === 0) return;
    inFlight.current = true;
    const ids = ops.map((o) => o.setLogId);
    setSync((s) => {
      const next = { ...s };
      for (const id of ids) if (next[id] !== "failed") next[id] = "sending";
      return next;
    });
    postSets(ops)
      .then(({ results, savedAtMs }) => {
        if (!alive.current) return;
        retryDelay.current = RETRY_MIN_MS;
        clearTimeout(retryTimer.current);
        setLoggedOut(false);
        // Finished or discarded elsewhere: nothing of it can be saved any more.
        if (results.some((r) => !r.ok && r.reason === "CLOSED")) {
          forgetLocalState();
          setSync({});
          refreshIfOnline(); // the page redirects (summary or Today)
          return;
        }
        let gone = false;
        const invalid: string[] = [];
        updateDrafts((d) => {
          const next = { ...d };
          for (const r of results) {
            const draft = next[r.setLogId];
            if (!draft || draft.rev !== revs[r.setLogId]) continue; // changed since: it goes again
            if (r.ok) {
              next[r.setLogId] = { ...draft, dirty: false, savedAt: savedAtMs, done: r.isCompleted };
            } else if (r.reason === "GONE") {
              gone = true;
              delete next[r.setLogId];
            } else {
              invalid.push(r.setLogId);
              delete next[r.setLogId];
            }
          }
          return next;
        });
        setSync((s) => {
          const next = { ...s };
          for (const id of ids) delete next[id];
          return next;
        });
        for (const id of invalid) setRowError(id, "Valores inválidos — confira kg e reps.");
        // A row removed on another device: show the workout as it is now.
        if (gone) refreshIfOnline();
        // The connection works: send whatever else is still waiting.
        if (Object.values(draftsRef.current).some((d) => d.dirty)) flushAgain.current = true;
      })
      .catch((err) => {
        if (!alive.current) return;
        setSync((s) => {
          const next = { ...s };
          for (const id of ids) next[id] = "failed";
          return next;
        });
        if (err instanceof LoggedOutError) {
          // Kept here and in the mirror; sent again when the app comes back to
          // the screen (e.g. after signing in in another tab) or on the next change.
          clearTimeout(retryTimer.current);
          setLoggedOut(true);
          return;
        }
        scheduleRetry();
      })
      .finally(() => {
        inFlight.current = false;
        // (Also after the screen is gone: its last edits go out once.)
        if (flushAgain.current) {
          flushAgain.current = false;
          flush();
        }
      });
  }

  // The listeners below outlive renders: they call the latest flush through a ref.
  const flushRef = useRef(flush);
  const unloadRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = flush;
    unloadRef.current = () => {
      // A normal request may not survive the page unloading; a keepalive one can.
      const { ops } = buildOps(true);
      if (ops.length === 0) return;
      try {
        void fetch("/api/workout/sets", {
          method: "POST",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ops }),
        }).catch(() => {});
      } catch {
        /* the local mirror still has them */
      }
    };
  });

  // Restore anything typed or ✓'d before a reload / tab kill, then send what the server lacks.
  useEffect(() => {
    pruneOtherWorkouts(session.id);
    const stored = readStoredDrafts(session.id);
    restored.current = true;
    const merged: Drafts = { ...draftsRef.current };
    for (const [id, d] of Object.entries(stored)) {
      // Rows gone from the workout (a removed extra) are dropped.
      if (!merged[id] && setByIdRef.current.has(id)) merged[id] = { ...d, rev: nextRev() };
    }
    if (Object.keys(merged).length === Object.keys(draftsRef.current).length) {
      writeStoredDrafts(session.id, draftsRef.current, sessionRef.current.loadedAtMs);
      return;
    }
    draftsRef.current = merged;
    setDrafts(merged);
    writeStoredDrafts(session.id, merged, sessionRef.current.loadedAtMs);
    flushRef.current();
  }, [session.id]);

  // Per-device conveniences (lib: local-workout prefs). localStorage has the
  // last word; the cookie the page rendered from is brought in step with it.
  useEffect(() => {
    const local = devicePrefsFrom(readWorkoutPref, session.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, only readable after hydration
    setSuggestionsLearned(local.suggestionsLearned);
    setWarmupsOpen(local.warmupsOpen);
    setLimitationsClosed(local.limitationsClosed);
    mirrorWorkoutPrefs();
  }, [session.id]);

  // The loading skeleton keeps room for the "Você informou" note
  // (limitations-echo.ts): how tall it stands here, folded as the screen
  // opens with it — nothing once it's gone (closed, or past the first workouts).
  useEffect(() => {
    if (limitationsOpen) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>("[data-limitations]");
      const px = el ? Math.round(el.getBoundingClientRect().height + (parseFloat(getComputedStyle(el).marginBottom) || 0)) : 0;
      rememberLimitationsEcho(px > 0 ? String(px) : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [exerciseIndex, limitationsOpen, limitationsClosed]);

  useEffect(() => {
    alive.current = true;
    const onVisibility = () => flushRef.current();
    const onOnline = () => {
      retryDelay.current = RETRY_MIN_MS;
      flushRef.current();
    };
    const onPageHide = () => unloadRef.current();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      clearTimeout(retryTimer.current);
      // Leaving the screen ("Ver técnica", back): send what's typed.
      flushRef.current();
      alive.current = false;
    };
  }, []);

  function goTo(i: number) {
    saveNote(exercise?.exerciseId, exercise?.persistentNote ?? null);
    const next = Math.max(0, Math.min(total - 1, i));
    if (next !== exerciseIndex) {
      focusHeading.current = true;
      announce(`${session.exercises[next]?.exerciseName ?? ""}, exercício ${next + 1} de ${total}`);
    }
    // Kept for coming back to it (only on a change the user made: never overwritten by a mount).
    const nextId = session.exercises[next]?.id;
    if (nextId) rememberShownExercise(session.id, nextId);
    setExerciseIndex(next);
    setLoadCheck(null);
    setConfirmSkip(false);
    setShowOverview(false);
    setExerciseError(null);
    setEditingNote(false);
    setNotesExpanded(false);
    setHintOpen(false);
    setLimitationsOpen(false);
    setSuggestionsLearned(devicePrefsFrom(readWorkoutPref, session.id).suggestionsLearned);
    window.scrollTo({ top: 0 });
  }

  function toggleWarmups() {
    const open = !warmupsOpen;
    setWarmupsOpen(open);
    writeWorkoutPref(WORKOUT_PREF.warmupsOpen, open ? "1" : null);
  }

  function changeField(id: string, field: DraftField, value: string) {
    setTouched(true);
    if (field === "weight" && loadCheck?.id === id) setLoadCheck(null);
    updateDrafts((d) => {
      const prev = d[id];
      const base = inForce(prev, sessionRef.current) ? prev : undefined;
      return {
        ...d,
        [id]: {
          values: { ...base?.values, [field]: value },
          done: base?.done,
          doneAt: base?.doneAt,
          dirty: true,
          savedAt: null,
          rev: nextRev(),
        },
      };
    });
    if (rowErrors[id]) setRowError(id, null);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => flush(), 1200);
  }

  function blurRow(id: string) {
    // After the focus has moved: a tap on this row's ✓ or next box keeps it
    // in one request with the ✓, and a ✓'d row left without kg or reps is flagged.
    setTimeout(() => {
      const entry = setByIdRef.current.get(id);
      const d = draftsRef.current;
      const current = sessionRef.current;
      if (entry && d[id]?.dirty && focusedRowId() !== id) {
        if (shownDone(entry.set, d, current) && !isFilled(shownValues(entry.set, d, current), entry.ex.bodyweight)) {
          setRowError(
            id,
            entry.ex.bodyweight
              ? `Preencha ${entry.ex.timed ? "os segundos" : "as reps"} — sem eles a série deixa de contar.`
              : "Preencha kg e reps — sem eles a série deixa de contar.",
          );
        }
      }
      // A row left with a load far from the reference and no ✓: asked about now —
      // saved at the finish as typed, a typo would become a record (W-088).
      const exRows = entry ? rowsByExercise[entry.index] : undefined;
      if (
        entry &&
        exRows &&
        entry.set.setType !== "WARMUP" &&
        !entry.ex.wasSkipped &&
        focusedRowId() !== id &&
        !shownDone(entry.set, d, current)
      ) {
        const kg = parseDecimalInput(shownValues(entry.set, d, current).weight);
        const jump = loadJump(entry.ex, exRows, id, kg, confirmedLoads.current);
        // The same question already asked on ✓ keeps its ✓ ("Está certo" then logs the set).
        if (jump) setLoadCheck((c) => (c?.id === id && c.kg === jump.kg ? c : { id, kg: jump.kg, text: jump.text, toggle: false }));
      }
      flushRef.current();
    }, 0);
  }

  function toggleRow(id: string) {
    const entry = setById.get(id);
    const row = [...rows.warmups, ...rows.prescribed, ...rows.extras].find((r) => r.id === id);
    if (!entry || !row) return;
    const now = Date.now();
    // A double tap must not log the set and undo it at once (a tap that only
    // showed "fill in the load" doesn't count: the next one may follow fast).
    if (now - (lastToggle.current[id] ?? 0) < 400) return;
    clearTimeout(typingTimer.current);
    setRowError(id, null);
    setTouched(true);
    const current = sessionRef.current;
    const values = shownValues(entry.set, draftsRef.current, current);

    if (shownDone(entry.set, draftsRef.current, current)) {
      lastToggle.current[id] = now;
      updateDrafts((d) => ({ ...d, [id]: { values, done: false, dirty: true, savedAt: null, rev: nextRev() } }));
      if (rest.timer?.setId === id) rest.dismiss();
      flush();
      return;
    }

    // ✓ on an empty box takes the grey suggestion (progression / last time / the row above / the program).
    const typed = parseRow(values, entry.ex.bodyweight);
    const weightKg = typed.weightKg ?? row.suggestion.weightKg;
    const reps = typed.reps ?? row.suggestion.reps;
    // A typed load far from the reference ("225" for 22,5) is asked about before it counts:
    // a typo would otherwise become a record every later set has to beat (W-088).
    if (row.kind !== "WARMUP" && reps !== null && reps >= 1) {
      const jump = loadJump(entry.ex, rows, id, typed.weightKg, confirmedLoads.current);
      if (jump) {
        setLoadCheck({ id, kg: jump.kg, text: jump.text, toggle: true });
        revealRow.current = id;
        return;
      }
    }
    if (loadCheck?.id === id) setLoadCheck(null);
    if (weightKg === null || reps === null || reps < 1) {
      if (weightKg === null && reps !== null && reps >= 1) {
        // A first time: the reps come from the program, the load is the user's call.
        setRowError(id, "Digite a carga (kg) que você usou.");
        pendingFocus.current = `${rowName(row)} — ${FIELD_LABEL.weight}`;
      } else if (entry.ex.bodyweight) {
        // No load to ask for: only the reps (a hold's seconds) are missing.
        setRowError(id, entry.ex.timed ? "Digite os segundos que você fez." : "Digite as reps que você fez.");
        pendingFocus.current = `${rowName(row)} — ${fieldLabel("reps", entry.ex.timed)}`;
      } else {
        setRowError(id, "Preencha kg e reps.");
      }
      return;
    }
    lastToggle.current[id] = now;
    // Counted only where the grey numbers were explained (the exercise has a
    // history): a first workout's ✓'s — kg typed, reps from the program — must
    // not fold the explanation before the progression's numbers ever show.
    if (
      row.kind !== "WARMUP" &&
      entry.ex.previousSets.length > 0 &&
      (typed.weightKg === null || typed.reps === null)
    ) {
      countSuggestionUsed();
    }
    const committed = { weight: formatDecimal(weightKg), reps: formatDecimal(Math.round(reps)), rir: values.rir };
    updateDrafts((d) => ({
      ...d,
      [id]: { values: committed, done: true, doneAt: now, dirty: true, savedAt: null, rev: nextRev() },
    }));
    // The PR moment: this set beats a real record (never a first time, never volume).
    if (row.kind !== "WARMUP") {
      const ordered = [...rows.prescribed, ...rows.extras].map((r) =>
        r.id === id ? { ...r, done: true, values: committed } : r,
      );
      if (recordRows(entry.ex.recordBars, workingRowsForRecords(ordered)).has(id)) {
        setPrFlash({ id, n: now });
        try {
          navigator.vibrate?.(30);
        } catch {
          // Not every browser lets a page vibrate.
        }
        announce(`Recorde pessoal: ${formatSet(weightKg, Math.round(reps), { timed: entry.ex.timed })}`);
      }
    }
    // The rest starts on the tap itself — never after a server round trip.
    if (row.kind !== "WARMUP") {
      if (session.restTimerSound) unlockRestAudio();
      rest.start({ seconds: entry.ex.restSeconds, after: entry.ex.exerciseName, exerciseIndex: entry.index, setId: id });
      const finishesExercise =
        !entry.ex.wasSkipped &&
        (rows.prescribed.length > 0
          ? rows.prescribed.every((r) => r.id === id || r.done)
          : !rows.extras.some((r) => r.id !== id && r.done));
      if (finishesExercise) revealCta.current = true;
    }
    flush();
  }

  function runExerciseAction(action: () => Promise<{ ok: boolean; reason?: string }>, failure: string, after?: () => void) {
    setExerciseError(null);
    startTransition(async () => {
      try {
        const r = await action();
        if (!r.ok) {
          if (r.reason === "CLOSED") refreshIfOnline();
          else setExerciseError(failure);
        }
      } catch (err) {
        if (!recoverFromStaleBuild(err)) setExerciseError(`${failure} Sem conexão?`);
      } finally {
        after?.();
      }
    });
  }

  function addExtra() {
    if (!exercise) return;
    setAddingExtra(true);
    runExerciseAction(() => addExtraSet(exercise.id), "Não foi possível adicionar a série extra.", () =>
      setAddingExtra(false),
    );
  }

  function removeExtra(id: string) {
    // Like un-✓: a rest started by this set ends with it.
    if (rest.timer?.setId === id) rest.dismiss();
    updateDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    runExerciseAction(() => removeSet(id), "Não foi possível remover a série extra.");
  }

  /**
   * The sheet's pick (W-006): swapped in place, added after the current
   * exercise (it already has sets) or at the end. The action refreshes the
   * page's data; the screen then shows the exercise it returned. Offline, the
   * sheet stays open with the reason — nothing changed.
   */
  function pickExercise(option: ExerciseOption, how: "swap" | "after" | "end") {
    const mode = swapSheet;
    if (!mode || swapBusy) return;
    const logId = mode.kind === "swap" ? mode.exerciseLogId : null;
    setSwapBusy(option.id);
    setSwapError(null);
    startTransition(async () => {
      try {
        let r: ExerciseChangeResult;
        if (how === "swap" && logId) r = await swapExercise(logId, option.id);
        else if (how === "after" && logId) r = await addExerciseToWorkout(session.id, option.id, { after: logId, replacing: true });
        else r = await addExerciseToWorkout(session.id, option.id);
        if (r.ok) {
          pendingExercise.current = r.exerciseLogId;
          focusHeading.current = true;
          setSwapSheet(null);
          announce(how === "swap" ? `Trocado por ${option.namePt}` : `${option.namePt} adicionado ao treino`);
        } else if (r.reason === "HAS_DATA" && mode.kind === "swap") {
          // Sets were saved meanwhile (another device): the pick can only go after it.
          setSwapSheet({ ...mode, hasLocalData: true });
          setSwapError("Este exercício ganhou séries salvas — toque de novo para adicionar o escolhido depois dele.");
        } else if (r.reason === "CLOSED") {
          setSwapSheet(null);
          refreshIfOnline();
        } else if (r.reason === "DUPLICATE") {
          setSwapError(`${option.namePt} já está neste treino — para fazer mais dele, use “Adicionar série extra”.`);
        } else {
          setSwapError(how === "swap" ? "Não foi possível trocar o exercício." : "Não foi possível adicionar o exercício.");
        }
      } catch (err) {
        if (!recoverFromStaleBuild(err)) setSwapError("Sem conexão — nada mudou no treino. Tente de novo quando o sinal voltar.");
      } finally {
        setSwapBusy(null);
      }
    });
  }

  function openSwap() {
    if (!exercise || !rows) return;
    const anyValue = [...rows.warmups, ...rows.prescribed, ...rows.extras].some(
      (r) => r.done || r.values.weight.trim() !== "" || r.values.reps.trim() !== "",
    );
    setSwapError(null);
    setSwapSheet({ kind: "swap", exerciseLogId: exercise.id, exerciseName: exercise.exerciseName, hasLocalData: anyValue });
  }

  function openAdd() {
    setSwapError(null);
    setShowOverview(false);
    setSwapSheet({ kind: "add" });
  }

  /** "Corrigir" on a load that was asked about: its kg box, selected for retyping. */
  function fixLoad(id: string) {
    setLoadCheck(null);
    const row = rows ? [...rows.prescribed, ...rows.extras].find((r) => r.id === id) : undefined;
    if (!row) return;
    const el = Array.from(document.querySelectorAll<HTMLInputElement>("input[aria-label]")).find(
      (input) => input.getAttribute("aria-label") === `${rowName(row)} — ${FIELD_LABEL.weight}`,
    );
    el?.focus();
    el?.select();
  }

  /** This row's load is right as typed: never asked about again (and no longer flagged at the finish). */
  function confirmKg(id: string, kg: number) {
    confirmedLoads.current = { ...confirmedLoads.current, [id]: kg };
    setConfirmed(confirmedLoads.current);
  }

  /** "Está certo": the number stands — and, asked on ✓, the row is ✓'d. */
  function confirmLoad(id: string) {
    const check = loadCheck?.id === id ? loadCheck : null;
    if (check) confirmKg(id, check.kg);
    setLoadCheck(null);
    if (!check || check.toggle) toggleRow(id);
  }

  function saveNote(exerciseId: string | undefined, persisted: string | null) {
    if (!exerciseId) return;
    const text = noteDrafts[exerciseId];
    const last = savedNotes.current[exerciseId] ?? persisted ?? "";
    if (text === undefined || text === last || staleBuild.current) return;
    setNoteStatus((s) => ({ ...s, [exerciseId]: { state: "saving", text } }));
    saveExerciseNote(exerciseId, text)
      .then(() => {
        savedNotes.current[exerciseId] = text;
        setNoteStatus((s) => ({ ...s, [exerciseId]: { state: "saved", text } }));
      })
      .catch((err) => {
        if (unstable_isUnrecognizedActionError(err)) staleBuild.current = true;
        setNoteStatus((s) => ({ ...s, [exerciseId]: { state: "error", text } }));
      });
  }

  /**
   * What this device typed, sent with the finish. Only local edits: rows filled
   * elsewhere are completed by the server from its own copy, and resending this
   * screen's older values could overwrite a correction made on another device.
   * A skipped exercise sends only rows already ✓'d.
   */
  function collectPending(): LogSetInput[] {
    const pending: LogSetInput[] = [];
    const d = draftsRef.current;
    for (const [id, draft] of Object.entries(d)) {
      const entry = setById.get(id);
      if (!entry || !draft.dirty) continue;
      if (entry.ex.wasSkipped && !shownDone(entry.set, d, session)) continue;
      pending.push({
        setLogId: id,
        ...parseRow(shownValues(entry.set, d, session), entry.ex.bodyweight),
        completedAtMs: draft.done === true ? (draft.doneAt ?? null) : null,
      });
    }
    return pending;
  }

  const stats: FinishStats = useMemo(() => {
    const s: FinishStats = {
      prescribedDone: 0,
      prescribedTotal: 0,
      extrasDone: 0,
      unconfirmed: 0,
      incomplete: 0,
      firstIncomplete: null,
      implausible: null,
      untouchedExercises: [],
    };
    session.exercises.forEach((ex, i) => {
      const r = rowsByExercise[i];
      let recorded = 0;
      let typed = false;
      // Same rule as the server: a filled row counts (a done row that lost its
      // values doesn't); a skipped exercise keeps only what was ✓'d.
      if (!ex.wasSkipped) s.prescribedTotal += r.prescribed.length;
      for (const row of [...r.prescribed, ...r.extras]) {
        const filled = isFilled(row.values, ex.bodyweight);
        const anyValue = row.values.weight.trim() !== "" || row.values.reps.trim() !== "";
        if (anyValue) typed = true;
        if (ex.wasSkipped ? !(row.done && filled) : !filled) {
          if (!ex.wasSkipped && anyValue) {
            s.incomplete++;
            if (s.firstIncomplete === null) {
              const field: DraftField = row.missing ?? (row.values.weight.trim() === "" ? "weight" : "reps");
              s.firstIncomplete = { exerciseIndex: i, inputLabel: `${rowName(row)} — ${fieldLabel(field, ex.timed)}` };
            }
          }
          continue;
        }
        if (ex.wasSkipped && row.kind !== "EXTRA") s.prescribedTotal++;
        recorded++;
        if (row.kind === "EXTRA") s.extrasDone++;
        else s.prescribedDone++;
        if (!row.done) {
          s.unconfirmed++;
          // Saved as typed without ✓ ever asking: a load far from the reference is asked about here (W-088).
          const jump = s.implausible ? null : loadJump(ex, r, row.id, parseDecimalInput(row.values.weight), confirmed);
          if (jump) {
            s.implausible = {
              exerciseIndex: i,
              inputLabel: `${rowName(row)} — ${FIELD_LABEL.weight}`,
              rowId: row.id,
              kg: jump.kg,
              text: jump.text,
              where: `${ex.exerciseName} · ${rowName(row)}`,
            };
          }
        }
      }
      if (recorded === 0 && !typed && !ex.wasSkipped) s.untouchedExercises.push(ex.exerciseName);
    });
    return s;
  }, [session.exercises, rowsByExercise, confirmed]);

  /** Opens the finish sheet on fresh data (sets may have been saved from another device). */
  function openSheet() {
    setFinishError(null);
    refreshIfOnline();
    setSheetOpen(true);
  }

  /** The workout is closed: nothing of it should linger on this device. */
  function forgetLocalState() {
    clearTimeout(typingTimer.current);
    clearTimeout(retryTimer.current);
    draftsRef.current = {};
    clearStoredDrafts(session.id);
    clearStoredRestTimer(session.id);
  }

  /**
   * The action opens the summary itself (one round trip). Until the server has
   * confirmed the finish, this device keeps its copy of everything — unsent
   * rows, the rest timer: the request may hang at the gym and the app be
   * closed or reclaimed meanwhile. It goes only once the finish went through:
   * the action's redirect rejects the call (before the summary is shown), and
   * that rejection is the confirmation.
   */
  function finish(mode: "now" | "stale") {
    setFinishError(null);
    setFinishMode(mode);
    const pending = collectPending();
    startFinishing(async () => {
      try {
        const r =
          mode === "stale"
            ? await finishStaleWorkoutSessionAndOpen(session.id, pending)
            : await finishWorkoutSession(session.id, pending);
        if (r.reason === "EMPTY") {
          setFinishError("Nenhuma série com kg e reps — preencha pelo menos uma para salvar.");
        } else {
          // Finished or discarded elsewhere: nothing here can be saved any more.
          forgetLocalState();
          router.replace("/app/today");
        }
      } catch (err) {
        if (isNavigation(err)) {
          forgetLocalState();
          setLeaving(true);
          return;
        }
        if (!recoverFromStaleBuild(err)) {
          setFinishError("Não foi possível finalizar — verifique a conexão e tente de novo. Nada do que você digitou foi perdido.");
        }
      }
    });
  }

  /** Abandons the workout; `then` is where to go afterwards (Today, with a one-time "Treino descartado."). */
  function discard(then = "/app/today?descartado=1") {
    setFinishError(null);
    // When this screen shows nothing recorded, never throw away sets that were
    // saved meanwhile from another device.
    const nothingRecorded = stats.prescribedDone + stats.extrasDone === 0;
    startDiscarding(async () => {
      try {
        const r = await discardWorkoutSession(session.id, { onlyIfEmpty: nothingRecorded });
        if (!r.ok && r.reason === "HAS_SETS") {
          setFinishError("Este treino tem séries salvas (talvez de outro aparelho). Atualizamos a tela — confira antes de descartar.");
          setSheetKey((k) => k + 1);
          refreshIfOnline();
          return;
        }
        forgetLocalState();
        router.replace(then);
      } catch (err) {
        if (!recoverFromStaleBuild(err)) setFinishError("Não foi possível descartar — sem conexão?");
      }
    });
  }

  const liveRegion = (
    <p role="status" aria-live="polite" className="sr-only" data-workout-announcer>
      {announcement.text}
      {/* Alternating padding makes a repeated message count as new. */}
      {announcement.n % 2 ? " " : ""}
    </p>
  );

  if (!exercise || !rows) {
    return (
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">Treino vazio</span>
        <h1 className="text-display text-2xl font-extrabold leading-tight">Nenhum exercício neste treino.</h1>
        <p className="text-sm text-muted">
          {session.programId
            ? `“${session.name}” ainda não tem exercícios. Adicione-os no editor do programa e inicie o dia de novo — ou descarte este treino.`
            : "Este treino não tem exercícios. Descarte-o para voltar a Hoje."}
        </p>
        {finishError ? (
          <p role="alert" className="border-l-2 border-l-danger bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {finishError}
          </p>
        ) : null}
        <div className="mt-2 flex flex-col gap-2">
          {session.programId ? (
            <Button size="lg" className="w-full" disabled={discarding} onClick={() => discard(`/app/programs/${session.programId}/edit`)}>
              <Plus className="size-4" />
              Adicionar exercícios
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={session.programId ? "secondary" : "primary"}
            className="w-full"
            disabled={discarding}
            onClick={() => discard()}
          >
            {discarding ? "Descartando…" : "Descartar treino"}
          </Button>
        </div>
      </div>
    );
  }

  const complete = rowsComplete(rows, exercise.wasSkipped);
  const isLast = exerciseIndex === total - 1;
  const noteValue = noteDrafts[exercise.exerciseId] ?? exercise.persistentNote ?? "";
  const note = noteStatus[exercise.exerciseId];
  const waiting = Object.keys(sync).filter((id) => sync[id] === "failed" && drafts[id]?.dirty).length;
  const waitingText = plural(waiting, "série", "séries");
  const hasHistory = exercise.previousSets.length > 0;
  const lastSummary = sameLoadSummary(exercise.previousSets, exercise.timed);
  const advice = exercise.advice;
  const firstReps = firstTimeReps(exercise.repMin, exercise.repMax);
  const rirButton = (text: string, className?: string) => (
    <button
      type="button"
      onClick={() => setRirSheetOpen(true)}
      aria-haspopup="dialog"
      className={cn("underline decoration-dotted underline-offset-2 hover:text-foreground", className)}
    >
      {text}
    </button>
  );
  const restNext =
    rest.timer && rest.timer.exerciseIndex === exerciseIndex && complete && !isLast
      ? { name: session.exercises[exerciseIndex + 1].exerciseName, onGo: () => goTo(exerciseIndex + 1) }
      : null;
  const staleSave = session.stale?.saveAsDay
    ? { since: session.stale.since, saveAsDay: session.stale.saveAsDay, preferred: session.stale.leftOpen && !touched }
    : null;

  return (
    <div className="flex min-h-dvh flex-col pb-40">
      {liveRegion}
      {/* Sticks below the status-bar inset the app shell paints (installed PWA draws under it). */}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{session.name}</p>
            <button
              type="button"
              onClick={() => setShowOverview((v) => !v)}
              aria-expanded={showOverview}
              className="-mx-1 -my-1.5 inline-flex min-h-11 items-center gap-1 rounded-[3px] px-1 text-xs text-muted hover:text-foreground"
            >
              <span className="text-left">
                Exercício {exerciseIndex + 1} de {total} ·{" "}
                {session.stale ? (
                  <span className="font-semibold text-warning">Aberto desde {session.stale.since}</span>
                ) : (
                  <ElapsedClock startedAtIso={session.startedAtIso} />
                )}{" "}
                <span className="whitespace-nowrap font-semibold text-accent">
                  · ver todos
                  <ChevronRight
                    className={`ml-0.5 inline size-3.5 align-[-2px] transition-transform ${showOverview ? "rotate-90" : ""}`}
                  />
                </span>
              </span>
            </button>
          </div>
          <Button variant="secondary" className="-my-1 shrink-0 px-4" onClick={openSheet}>
            Finalizar
          </Button>
        </div>
        {session.week ? (
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={() => setWeekOpen((v) => !v)}
              aria-expanded={weekOpen}
              data-week-chip
              // A 44px tap target (the gym's size) around a 28px chip: the ::after
              // reaches 16px down, outside the layout (clear of "ver todos" above) —
              // so a chip that wraps on a narrow phone still pushes the header down
              // instead of running into its edge.
              className="relative -my-1 inline-flex min-h-7 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 py-1 text-left font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted after:absolute after:inset-x-0 after:top-0 after:-bottom-4 after:content-[''] hover:text-foreground"
            >
              <span className="whitespace-nowrap bg-surface-2 px-1.5 py-0.5 text-foreground">{weekChip}</span>
              <span className="whitespace-nowrap text-accent">
                Instruções
                {/* A long week line ("Sem. de entrada · alvo RIR 3") keeps one line on a 390px phone. */}
                <span className={weekChip.length >= 20 ? "max-[419px]:hidden" : "max-[359px]:hidden"}> da semana</span>
              </span>
              <ChevronDown className={cn("size-3 shrink-0 text-accent transition-transform", weekOpen && "rotate-180")} />
            </button>
          </div>
        ) : null}
        {session.week && weekOpen ? (
          <div className="mx-auto mt-2 max-w-3xl border-l-2 border-l-accent bg-surface-2 px-3 py-2.5 text-xs" data-week-guidance>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">
              {session.week.title}
              {session.week.test ? " · semana de teste" : session.week.deload ? " · deload" : ""}
              {session.week.rirTarget != null ? ` · RIR alvo ${formatDecimal(session.week.rirTarget)}` : ""}
            </p>
            {session.week.rirTarget != null ? (
              <p className="mt-1.5 leading-relaxed text-muted">
                O RIR de cada exercício já segue esta semana, sem descer do mínimo de cada um.
              </p>
            ) : null}
            {session.week.notePt ? <p className="mt-1.5 leading-relaxed text-foreground/90">{session.week.notePt}</p> : null}
            {session.week.setsNotePt ? (
              <p className="mt-1.5 leading-relaxed text-foreground/90">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">Séries · </span>
                {session.week.setsNotePt}
              </p>
            ) : null}
            <Link
              href={session.week.deload || session.week.test ? "/app/science/deloads" : "/app/science/rir"}
              className="-my-1 mt-1 inline-flex items-center gap-1 py-2 font-semibold text-accent hover:underline"
            >
              {session.week.deload || session.week.test ? "Por que semanas leves" : "Entenda o RIR"}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        ) : null}
        <div role="status" className="mx-auto max-w-3xl">
          {waiting > 0 && loggedOut ? (
            <p className="mt-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-warning">
              Sessão expirada —{" "}
              <Link href="/login" className="-my-3 inline-block py-3 text-accent underline underline-offset-2">
                entre de novo
              </Link>{" "}
              para enviar {waitingText}
            </p>
          ) : waiting > 0 ? (
            <p className="tag tag--status tag--warn mt-1.5 font-mono">{waitingText} aguardando conexão</p>
          ) : null}
        </div>

        {showOverview ? (
          <div className="mx-auto mt-3 max-w-3xl panel-raised">
            <ul className="divide-y divide-border">
              {session.exercises.map((ex, i) => {
                const r = rowsByExercise[i];
                const counts = (row: SetTableRowModel) =>
                  ex.wasSkipped ? row.done && isFilled(row.values, ex.bodyweight) : isFilled(row.values, ex.bodyweight);
                const doneCount = r.prescribed.filter(counts).length;
                const extrasDone = r.extras.filter(counts).length;
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={i === exerciseIndex ? "true" : undefined}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 ${
                        i === exerciseIndex ? "bg-accent-soft" : ""
                      }`}
                    >
                      <span className="w-5 shrink-0 font-mono text-xs text-muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {/* Two lines: long names differ only at the end (grip, cable position). */}
                      <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug wrap-break-word">
                        {ex.exerciseName}
                      </span>
                      {ex.wasSkipped ? (
                        <span className="tag tag--mark shrink-0">Pulado</span>
                      ) : rowsComplete(r, false) ? (
                        <GCheck className="size-4 shrink-0 text-accent" />
                      ) : (
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {doneCount}/{r.prescribed.length}
                          {extrasDone > 0 ? ` +${extrasDone}` : ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={openAdd}
                  aria-haspopup="dialog"
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-accent hover:bg-surface-2"
                >
                  <Plus className="size-4 w-5 shrink-0" />
                  Adicionar exercício
                </button>
              </li>
            </ul>
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        {showNotice ? (
          <div className="mb-4 flex items-start gap-2 border-l-2 border-l-warning! bg-warning-soft px-3 py-2.5 text-xs">
            <p className="flex-1 text-foreground/90">
              <span className="font-semibold">Este treino ainda está em andamento.</span> Finalize ou descarte-o para
              começar outro.
            </p>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setShowNotice(false)}
              className="-m-2 flex size-11 shrink-0 items-center justify-center text-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {session.limitations && !limitationsClosed ? (
          <LimitationsEcho
            text={session.limitations}
            // In full on the first exercise; a one-line reminder on the others,
            // so it never pushes the sets below the fold on every screen.
            mode={exerciseIndex === 0 ? "full" : "line"}
            open={limitationsOpen}
            onToggle={() => setLimitationsOpen((v) => !v)}
            onClose={() => {
              setLimitationsClosed(true);
              writeWorkoutPref(WORKOUT_PREF.limitationsClosed, session.id);
            }}
          />
        ) : null}

        {/* Full width: long names differ only at the end (grip, cable position). */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={cn("text-xl font-bold leading-tight wrap-break-word outline-none", exercise.substitutedFromName ? "mb-1" : "mb-3")}
        >
          {exercise.exerciseName}
        </h1>
        {exercise.substitutedFromName ? (
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted" data-substituted>
            <ArrowLeftRight aria-hidden className="mr-1 inline size-3.5 align-[-2px] text-accent" />
            Trocado ·{" "}
            <span className="font-sans font-medium normal-case tracking-normal">no lugar de {exercise.substitutedFromName}</span>
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => goTo(exerciseIndex - 1)}
            disabled={exerciseIndex === 0}
            className="flex size-11 shrink-0 items-center justify-center rounded-[3px] border border-border disabled:opacity-30"
            aria-label="Exercício anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-1">
            {/* The photo opens the technique sheet too (W-025). */}
            <button
              type="button"
              onClick={() => setTechniqueOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Ver técnica de ${exercise.exerciseName}`}
              className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2"
            >
              {exercise.imageUrl ? (
                <Image src={exercise.imageUrl} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-muted">
                  <GLoad className="size-5" />
                </span>
              )}
            </button>
            <p className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted">
              <span className="text-sm font-semibold text-foreground">
                <span className="whitespace-nowrap">{plural(exercise.prescribedSets, "série", "séries")}</span>{" "}
                <span className="whitespace-nowrap">
                  ×{" "}
                  {exercise.timed
                    ? // A hold: the numbers are seconds ("3 séries × 20–45 s").
                      `${exercise.repMin === exercise.repMax ? exercise.repMin : `${exercise.repMin}–${exercise.repMax}`} s`
                    : exercise.repMin === exercise.repMax
                      ? plural(exercise.repMin, "rep", "reps")
                      : `${exercise.repMin}–${exercise.repMax} reps`}
                </span>
              </span>
              {exercise.rirTarget != null
                ? rirButton(formatRir(exercise.rirTarget), "-my-3 whitespace-nowrap py-3")
                : null}
              <span className="whitespace-nowrap">Descanso {formatRest(exercise.restSeconds)}</span>
            </p>
          </div>
          <button
            onClick={() => goTo(exerciseIndex + 1)}
            disabled={isLast}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-[3px] border disabled:opacity-30",
              complete && !isLast ? "border-accent bg-accent-soft text-accent" : "border-border",
            )}
            aria-label="Próximo exercício"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3">
          <button
            type="button"
            onClick={() => setTechniqueOpen(true)}
            aria-haspopup="dialog"
            className="-mx-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs text-accent hover:underline"
          >
            <Info className="size-3.5" />
            Ver técnica
          </button>
          {/* The machine is taken, the gym has no such equipment: do something else in its place (W-006). */}
          <button
            type="button"
            onClick={openSwap}
            aria-haspopup="dialog"
            className="-mx-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs text-accent hover:underline"
          >
            <ArrowLeftRight className="size-3.5" />
            Trocar
          </button>
          {exercise.wasSkipped ? null : (
            <button
              onClick={() => {
                if (confirmSkip) {
                  setConfirmSkip(false);
                  runExerciseAction(() => skipExercise(exercise.id, true), "Não foi possível pular.");
                } else {
                  setConfirmSkip(true);
                }
              }}
              // Under 360px the four actions keep one line with the short words ("Pular"); the name stays whole.
              aria-label={confirmSkip ? "Confirmar pular?" : "Pular exercício"}
              className={`-mx-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs ${
                confirmSkip ? "font-semibold text-danger" : "text-muted hover:text-foreground"
              }`}
            >
              <SkipForward className="size-3.5" />
              {confirmSkip ? (
                <>
                  <span className="max-[359px]:hidden">Confirmar pular?</span>
                  <span aria-hidden className="hidden max-[359px]:inline">
                    Pular?
                  </span>
                </>
              ) : (
                <>
                  Pular<span className="max-[359px]:hidden"> exercício</span>
                </>
              )}
            </button>
          )}
          {!editingNote && noteValue.trim() === "" ? (
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              aria-label="Adicionar nota do exercício/máquina"
              className="-mx-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs text-muted hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Nota
            </button>
          ) : null}
        </div>

        {/* The user's own note for this exercise (machine settings…), kept across workouts. */}
        {editingNote ? (
          <div className="mt-1">
            <label
              htmlFor="exercise-note"
              className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted"
            >
              <GNotes className="size-3.5" />
              Nota do exercício/máquina
            </label>
            <textarea
              key={exercise.exerciseId}
              id="exercise-note"
              autoFocus
              value={noteValue}
              onChange={(e) => {
                const text = e.target.value;
                setNoteDrafts((n) => ({ ...n, [exercise.exerciseId]: text }));
                if (note && note.state !== "saving") {
                  setNoteStatus((s) => {
                    const next = { ...s };
                    delete next[exercise.exerciseId];
                    return next;
                  });
                }
              }}
              onBlur={() => {
                saveNote(exercise.exerciseId, exercise.persistentNote);
                setEditingNote(false);
              }}
              placeholder="Ex.: banco na posição 4"
              // 16px on phones: iOS zooms into smaller fields on focus.
              className="mt-1.5 w-full rounded-[3px] border border-foreground/50 bg-surface px-3 py-2 text-base sm:text-sm"
              rows={2}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted">Fica salva para as próximas vezes neste exercício.</p>
              {/* Tapping it blurs the box, which saves. */}
              <button type="button" className="-my-2 min-h-11 shrink-0 px-2 text-xs font-semibold text-accent">
                OK
              </button>
            </div>
          </div>
        ) : noteValue.trim() !== "" ? (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            aria-label={`Nota do exercício/máquina: ${noteValue} — toque para editar`}
            className="mt-1 flex min-h-11 w-full items-center gap-2 border-l-2 border-l-foreground/40 bg-surface-2 px-3 py-2 text-left text-xs text-foreground/90 hover:bg-[var(--border)]"
          >
            <GNotes className="size-3.5 shrink-0 text-muted" />
            <span className="line-clamp-2 min-w-0 flex-1 wrap-break-word">{noteValue}</span>
            <Pencil className="size-3.5 shrink-0 text-muted" />
          </button>
        ) : null}
        {/* The note's save line is announced (W-172). */}
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em]",
            note ? "mt-1 min-h-5" : "",
          )}
        >
          {note?.state === "saving" ? (
            <span className="text-muted">Salvando nota…</span>
          ) : note?.state === "saved" && note.text === noteValue ? (
            <span className="text-success">Nota salva ✓</span>
          ) : note?.state === "error" ? (
            <>
              <span className="text-danger">Nota não salva</span>
              <button
                type="button"
                onClick={() => saveNote(exercise.exerciseId, exercise.persistentNote)}
                className="-my-3 min-h-11 px-1 uppercase text-accent underline underline-offset-2"
              >
                Tentar de novo
              </button>
            </>
          ) : null}
        </div>

        {exercise.wasSkipped ? (
          <div className="mt-3 flex items-center justify-between gap-3 bg-surface-2 px-3 py-2 text-xs">
            <span className="text-muted">Exercício pulado — só as séries já marcadas com ✓ contam.</span>
            <button
              type="button"
              onClick={() => runExerciseAction(() => skipExercise(exercise.id, false), "Não foi possível desfazer.")}
              className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent"
            >
              <Undo2 className="size-3.5" />
              Desfazer
            </button>
          </div>
        ) : null}

        {exercise.notes ? (
          exercise.notes.length > LONG_NOTE_CHARS ? (
            // Folded to two lines; the whole note opens on a tap.
            <button
              type="button"
              onClick={() => setNotesExpanded((v) => !v)}
              aria-expanded={notesExpanded}
              className="mt-3 flex w-full items-start gap-2 border-l-2 border-l-accent bg-surface-2 px-3 py-2 text-left text-xs text-foreground/90"
            >
              <span className={cn("min-w-0 flex-1", !notesExpanded && "line-clamp-2")}>{exercise.notes}</span>
              <ChevronDown
                aria-hidden
                className={cn("mt-0.5 size-3.5 shrink-0 text-accent transition-transform", notesExpanded && "rotate-180")}
              />
              <span className="sr-only">{notesExpanded ? "Mostrar menos" : "Ler tudo"}</span>
            </button>
          ) : (
            <p className="mt-3 border-l-2 border-l-accent bg-surface-2 px-3 py-2 text-xs text-foreground/90">
              {exercise.notes}
            </p>
          )
        ) : null}

        {hasHistory ? (
          <div className="mt-4 border-l-2 border-l-border-strong bg-surface-2" data-last-time>
            <Link
              href={`/app/exercises/${exercise.exerciseSlug}/history`}
              aria-label={`Último treino${exercise.lastTime ? `, ${exercise.lastTime.date}, ${exercise.lastTime.ago}` : ""} — ver o histórico do exercício`}
              className="flex min-h-10 items-center justify-between gap-2 px-3.5 pt-1 font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted hover:text-foreground"
            >
              <span>
                Último treino
                {exercise.lastTime ? (
                  // "· 19/09 ·" and "há 7 dias" each wrap as a whole: never "dias" (or a "·") alone on a line.
                  <span className="font-medium">
                    {" "}
                    <span className="whitespace-nowrap">· {exercise.lastTime.date} ·</span>{" "}
                    <span className="whitespace-nowrap">{exercise.lastTime.ago}</span>
                  </span>
                ) : null}
              </span>
              <ChevronRight className="size-4 shrink-0 text-accent" />
            </Link>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-3.5 pb-3 font-mono text-sm tabular-nums">
              {lastSummary ? (
                <>
                  <span>{lastSummary.text}</span>
                  {lastSummary.rir ? <span className="text-xs leading-5 text-muted">RIR {lastSummary.rir}</span> : null}
                </>
              ) : (
                exercise.previousSets.map((s, i) => (
                  <span key={i} className={cn("whitespace-nowrap", s.isExtra && "text-muted")}>
                    {s.isExtra ? "+" : ""}
                    {formatSet(s.weightKg, s.reps, { timed: exercise.timed })}
                    {s.rir !== null ? <span className="text-xs text-muted"> · {formatRir(s.rir)}</span> : null}
                  </span>
                ))
              )}
            </div>
            {advice ? (
              <div
                data-advice={advice.kind}
                className={cn("border-t border-border px-3.5 py-2.5", advice.kind === "increase" && "bg-accent-soft")}
              >
                <p className={cn("text-sm font-bold", advice.kind === "increase" ? "text-accent" : "text-foreground")}>
                  {advice.headline}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {advice.reason}
                  {advice.whyHref ? (
                    <>
                      {" · "}
                      <Link
                        href={advice.whyHref}
                        className="-my-2 inline-block py-2 font-semibold text-accent underline underline-offset-2"
                      >
                        por quê?
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            ) : exercise.strategy === "RIR_BASED" && exercise.previousSets.some((s) => !s.isExtra && s.rir === null) ? (
              <p className="border-t border-border px-3.5 py-2.5 text-xs text-muted">
                Anote o {rirButton("RIR")} de cada série: neste exercício a carga da próxima vez vem dele.
              </p>
            ) : null}
          </div>
        ) : !exercise.wasSkipped ? (
          <div className="mt-3 border-l-2 border-l-accent bg-accent-soft px-3 py-2.5 text-xs text-foreground/90" data-first-time>
            <p>
              <span className="mr-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
                {session.firstWorkout ? "Primeiro treino" : "Primeira vez neste exercício"}
              </span>
              {exercise.bodyweight ? (
                // No load to pick: the reps (a hold's seconds) are the whole set; kg is extra load.
                <>
                  {exercise.timed ? (
                    <>Segure ~{firstReps ?? exercise.repMax}&nbsp;s sem perder a posição</>
                  ) : (
                    <>
                      Faça ~{firstReps ?? exercise.repMax} reps{" "}
                      {exercise.rirTarget != null ? (
                        <>
                          {rirSpareWords(exercise.rirTarget, true)}{" "}
                          <span className="whitespace-nowrap">({rirButton(formatRir(exercise.rirTarget))})</span>
                        </>
                      ) : (
                        "sem chegar à falha"
                      )}
                    </>
                  )}
                  {/* Non-breaking before the dash: a line never starts with "—". */}
                  {"\u00a0"}— kg só se usar carga extra. {exercise.timed ? "Anote os segundos" : "Anote as reps"} que fez e
                  toque{"\u00a0"}✓.{" "}
                  <span className="text-muted">
                    Na próxima vez, {exercise.timed ? "seus tempos" : "suas reps"} de hoje viram a referência.
                  </span>
                </>
              ) : exercise.timed ? (
                // A loaded hold (Pinça de Anilha): the load is picked for the seconds, and the
                // grey seconds in the rows are the program's.
                <>
                  Escolha uma carga que você seguraria ~{firstReps ?? exercise.repMax}&nbsp;s sem chegar ao limite.{" "}
                  {firstReps !== null ? "Digite só os kg e toque ✓." : null}{" "}
                  <span className="text-muted">Na próxima vez, sugerimos a carga.</span>
                </>
              ) : (
                <>
                  Escolha uma carga que você faria ~{firstReps ?? exercise.repMax}×{" "}
                  {exercise.rirTarget != null ? (
                    <>
                      {rirSpareWords(exercise.rirTarget)}{" "}
                      {/* One piece: ")." never starts a line of its own. */}
                      <span className="whitespace-nowrap">({rirButton(formatRir(exercise.rirTarget))}).</span>
                    </>
                  ) : (
                    "sem chegar à falha."
                  )}{" "}
                  {/* The grey reps in the rows are the program's: the load is all that's asked. */}
                  {firstReps !== null ? "Digite só os kg e toque\u00a0✓." : null}{" "}
                  <span className="text-muted">Na próxima vez, sugerimos a carga.</span>
                </>
              )}
            </p>
          </div>
        ) : null}

        <div className="mt-4">
          <SetTable
            warmups={rows.warmups}
            prescribed={rows.prescribed}
            extras={rows.extras}
            prescribedCount={rows.prescribed.length}
            hint={{
              mode: !hasHistory ? "none" : suggestionsLearned ? "folded" : "shown",
              source: advice ? "progression" : "last-time",
              open: hintOpen,
              onToggle: () => setHintOpen((v) => !v),
            }}
            onChange={changeField}
            onBlurRow={blurRow}
            onToggle={toggleRow}
            onRemoveExtra={removeExtra}
            onAddExtra={addExtra}
            addingExtra={addingExtra}
            warmupsOpen={warmupsOpen}
            onToggleWarmups={toggleWarmups}
            onExplainRir={() => setRirSheetOpen(true)}
            timed={exercise.timed}
            flashRowId={prFlash}
            loadCheck={loadCheck && rows.prescribed.concat(rows.extras).some((r) => r.id === loadCheck.id) ? loadCheck : null}
            onConfirmLoad={confirmLoad}
            onFixLoad={fixLoad}
          />
        </div>

        {exerciseError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {exerciseError}
          </p>
        ) : null}

        {/* Clears the rest bar when brought into view after the last set. */}
        {isLast ? (
          <>
            <button
              type="button"
              onClick={openAdd}
              aria-haspopup="dialog"
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 px-3 text-sm font-semibold text-accent hover:underline"
            >
              <Plus className="size-4" />
              Adicionar exercício
            </button>
            <Button ref={ctaRef} className="mt-2 w-full scroll-mb-40" size="lg" variant="strong" onClick={openSheet}>
              <GCheck className="size-4" />
              Finalizar treino
            </Button>
          </>
        ) : (
          <Button
            ref={ctaRef}
            className={cn(
              "mt-6 w-full scroll-mb-40",
              // Until the exercise is done: a quieter but clearly tappable button (not a bare underline).
              !complete && "border border-foreground/25 shadow-[inset_0_-2px_0_var(--keel)]",
            )}
            size="lg"
            variant={complete ? "primary" : "secondary"}
            onClick={() => goTo(exerciseIndex + 1)}
          >
            Próximo exercício
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      {rest.timer ? (
        <RestTimerBar
          key={rest.timer.id}
          timer={rest.timer}
          sound={session.restTimerSound}
          next={restNext}
          upNext={upNextText(rows, exercise)}
          onAdjust={rest.adjust}
          onTogglePause={rest.togglePause}
          onDismiss={rest.dismiss}
          onAnnounce={announce}
        />
      ) : null}

      {rirSheetOpen ? (
        <RirSheet
          target={exercise.rirTarget}
          rirDrivesLoad={exercise.strategy === "RIR_BASED"}
          onClose={() => setRirSheetOpen(false)}
        />
      ) : null}

      {techniqueOpen ? (
        <TechniqueSheet
          exercise={{ exerciseId: exercise.exerciseId, name: exercise.exerciseName, imageUrl: exercise.imageUrl }}
          // The full page, and the way back to this exercise of this workout.
          fullHref={`/app/exercises/${exercise.exerciseSlug}?from=${encodeURIComponent(`/app/workout/${session.id}?ex=${exercise.id}`)}`}
          onClose={() => setTechniqueOpen(false)}
        />
      ) : null}

      {swapSheet ? (
        <ExerciseSwapSheet
          sessionId={session.id}
          mode={swapSheet}
          busyId={swapBusy}
          error={swapError}
          onPick={pickExercise}
          onClose={() => {
            setSwapSheet(null);
            setSwapError(null);
          }}
        />
      ) : null}

      {sheetOpen ? (
        <FinishSheet
          key={sheetKey}
          stats={stats}
          stale={staleSave}
          finishing={finishing ? finishMode : null}
          discarding={discarding}
          error={finishError}
          onFinish={() => finish("now")}
          onFinishStale={() => finish("stale")}
          onDiscard={() => discard()}
          onReview={({ exerciseIndex: i, inputLabel }) => {
            setSheetOpen(false);
            goTo(i);
            pendingFocus.current = inputLabel;
          }}
          onReviewLoad={({ exerciseIndex: i, inputLabel, rowId, kg, text }) => {
            setSheetOpen(false);
            goTo(i);
            pendingFocus.current = inputLabel;
            // The row says it too, with "Corrigir" / "Está certo".
            setLoadCheck({ id: rowId, kg, text, toggle: false });
          }}
          onConfirmLoad={confirmKg}
          onClose={() => {
            setSheetOpen(false);
            setFinishError(null);
          }}
        />
      ) : null}
    </div>
  );
}
