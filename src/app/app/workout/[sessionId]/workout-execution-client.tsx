"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, unstable_isUnrecognizedActionError } from "next/navigation";
import { ChevronLeft, ChevronRight, Info, Plus, SkipForward, Undo2, X } from "lucide-react";
import { GLoad, GNotes, GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  addExtraSet,
  discardWorkoutSession,
  finishStaleWorkoutSession,
  finishWorkoutSession,
  removeSet,
  skipExercise,
  type LogSetInput,
  type SetSyncOp,
  type SetSyncResult,
} from "@/lib/actions/workouts";
import { saveExerciseNote } from "@/lib/actions/exercise-notes";
import {
  formatDecimal,
  isExerciseDone,
  parseDecimalInput,
  planRows,
  suggestFor,
  type SuggestedValues,
} from "@/lib/training/set-plan";
import { DRAFTS_KEY_PREFIX, REST_KEY_PREFIX, draftsKey, restKey } from "@/components/workout/local-workout";
import { FIELD_LABEL, SetTable, rowName, type DraftField, type SetTableRowModel } from "./set-table";
import { FinishSheet, type FinishStats } from "./finish-sheet";
import { RestTimerBar, clearStoredRestTimer, useRestTimer } from "./rest-timer";
import { unlockRestAudio } from "./rest-audio";
import { useWakeLock } from "./use-wake-lock";
import type { ExecutionExerciseLog, ExecutionSession, ExecutionSetLog } from "./types";

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
function parseRow(v: RowValues) {
  return { weightKg: parseDecimalInput(v.weight), reps: parseDecimalInput(v.reps), rir: parseDecimalInput(v.rir) };
}
function isFilled(v: RowValues) {
  const p = parseRow(v);
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
  let above: SuggestedValues | null = null;
  const toModel = (r: (typeof plan.prescribed)[number]): SetTableRowModel => {
    const values = shownValues(r.set, drafts, current);
    const suggestion = suggestFor(r.kind, r.ordinal, above, ex.previousSets);
    const p = parseRow(values);
    if (r.kind !== "WARMUP" && p.weightKg !== null) above = { weightKg: p.weightKg, reps: p.reps ?? suggestion.reps };
    const isDone = shownDone(r.set, drafts, current);
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
      missing: !isDone && !ex.wasSkipped && hasW !== hasR ? (hasW ? "reps" : "weight") : null,
    };
  };
  return {
    warmups: plan.warmups.map(toModel),
    prescribed: plan.prescribed.map(toModel),
    extras: plan.extras.map(toModel),
  };
}

function rowsComplete(rows: ExerciseRows, skipped: boolean) {
  if (skipped) return true;
  if (rows.prescribed.length > 0) return rows.prescribed.every((r) => r.done);
  return rows.extras.some((r) => r.done);
}

/** "Série 3 · 60 kg × 10": the next set to do in an exercise, with the numbers to aim for. */
function upNextText(rows: ExerciseRows): string | null {
  const row = [...rows.prescribed, ...rows.extras].find((r) => !r.done);
  if (!row) return null;
  const kg = row.values.weight.trim() || formatDecimal(row.suggestion.weightKg);
  const reps = row.values.reps.trim() || formatDecimal(row.suggestion.reps);
  return `${rowName(row)}${kg && reps ? ` · ${kg} kg × ${reps}` : ""}`;
}

type NoteStatus = { state: "saving" | "saved" | "error"; text: string };

export function WorkoutExecutionClient({ session }: { session: ExecutionSession }) {
  const router = useRouter();
  const total = session.exercises.length;
  const [exerciseIndex, setExerciseIndex] = useState(() => {
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
  const [finishing, startFinishing] = useTransition();
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
  const ctaRef = useRef<HTMLButtonElement>(null);
  const lastToggle = useRef<Record<string, number>>({});
  const savedNotes = useRef<Record<string, string>>({});
  const [sheetKey, setSheetKey] = useState(0);
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
  });

  useEffect(() => {
    if (!confirmSkip) return;
    const t = setTimeout(() => setConfirmSkip(false), 4000);
    return () => clearTimeout(t);
  }, [confirmSkip]);

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
      const filled = isFilled(values);
      // Don't un-count a ✓'d set under the user's fingers while they retype it.
      if (id === focused && shownDone(entry.set, d, current) && !filled) continue;
      let done = draft.done ?? null;
      if (done === true && !filled) done = false;
      ops.push({ setLogId: id, ...parseRow(values), done, completedAtMs: done === true ? (draft.doneAt ?? null) : null });
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
    setExerciseIndex(Math.max(0, Math.min(total - 1, i)));
    setConfirmSkip(false);
    setShowOverview(false);
    setExerciseError(null);
    window.scrollTo({ top: 0 });
  }

  function changeField(id: string, field: DraftField, value: string) {
    setTouched(true);
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
      if (entry && d[id]?.dirty && focusedRowId() !== id) {
        const current = sessionRef.current;
        if (shownDone(entry.set, d, current) && !isFilled(shownValues(entry.set, d, current))) {
          setRowError(id, "Preencha kg e reps — sem eles a série deixa de contar.");
        }
      }
      flushRef.current();
    }, 0);
  }

  function toggleRow(id: string) {
    const entry = setById.get(id);
    const row = [...rows.warmups, ...rows.prescribed, ...rows.extras].find((r) => r.id === id);
    if (!entry || !row) return;
    const now = Date.now();
    // A double tap must not log the set and undo it at once.
    if (now - (lastToggle.current[id] ?? 0) < 400) return;
    lastToggle.current[id] = now;
    clearTimeout(typingTimer.current);
    setRowError(id, null);
    setTouched(true);
    const current = sessionRef.current;
    const values = shownValues(entry.set, draftsRef.current, current);

    if (shownDone(entry.set, draftsRef.current, current)) {
      updateDrafts((d) => ({ ...d, [id]: { values, done: false, dirty: true, savedAt: null, rev: nextRev() } }));
      if (rest.timer?.setId === id) rest.dismiss();
      flush();
      return;
    }

    // ✓ on an empty box takes the grey suggestion (last time / the row above).
    const typed = parseRow(values);
    const weightKg = typed.weightKg ?? row.suggestion.weightKg;
    const reps = typed.reps ?? row.suggestion.reps;
    if (weightKg === null || reps === null || reps < 1) {
      setRowError(id, "Preencha kg e reps.");
      return;
    }
    const committed = { weight: formatDecimal(weightKg), reps: formatDecimal(Math.round(reps)), rir: values.rir };
    updateDrafts((d) => ({
      ...d,
      [id]: { values: committed, done: true, doneAt: now, dirty: true, savedAt: null, rev: nextRev() },
    }));
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
        ...parseRow(shownValues(entry.set, d, session)),
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
        const filled = isFilled(row.values);
        const anyValue = row.values.weight.trim() !== "" || row.values.reps.trim() !== "";
        if (anyValue) typed = true;
        if (ex.wasSkipped ? !(row.done && filled) : !filled) {
          if (!ex.wasSkipped && anyValue) {
            s.incomplete++;
            if (s.firstIncomplete === null) {
              const field: DraftField = row.missing ?? (row.values.weight.trim() === "" ? "weight" : "reps");
              s.firstIncomplete = { exerciseIndex: i, inputLabel: `${rowName(row)} — ${FIELD_LABEL[field]}` };
            }
          }
          continue;
        }
        if (ex.wasSkipped && row.kind !== "EXTRA") s.prescribedTotal++;
        recorded++;
        if (row.kind === "EXTRA") s.extrasDone++;
        else s.prescribedDone++;
        if (!row.done) s.unconfirmed++;
      }
      if (recorded === 0 && !typed && !ex.wasSkipped) s.untouchedExercises.push(ex.exerciseName);
    });
    return s;
  }, [session.exercises, rowsByExercise]);

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

  function finish(mode: "now" | "stale") {
    setFinishError(null);
    setFinishMode(mode);
    const pending = collectPending();
    startFinishing(async () => {
      try {
        const r =
          mode === "stale"
            ? await finishStaleWorkoutSession(session.id, pending)
            : await finishWorkoutSession(session.id, pending);
        if (r.ok) {
          forgetLocalState();
          router.replace(r.summaryUrl);
        } else if (r.reason === "EMPTY") {
          setFinishError("Nenhuma série com kg e reps — preencha pelo menos uma para salvar.");
        } else {
          router.replace("/app/today");
        }
      } catch (err) {
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
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Treino vazio</span>
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
  const waitingText = waiting === 1 ? "1 série" : `${waiting} séries`;
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
        <div role="status" className="mx-auto max-w-3xl">
          {waiting > 0 && loggedOut ? (
            <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-warning">
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
                  ex.wasSkipped ? row.done && isFilled(row.values) : isFilled(row.values);
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
                      <span className="w-5 shrink-0 font-mono text-xs text-foreground/30">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{ex.exerciseName}</span>
                      {ex.wasSkipped ? (
                        <span className="tag tag--mark shrink-0">Pulado</span>
                      ) : rowsComplete(r, false) ? (
                        <GCheck className="size-4 shrink-0 text-accent" />
                      ) : (
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          {doneCount}/{r.prescribed.length}
                          {extrasDone > 0 ? ` +${extrasDone}` : ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
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

        {/* Full width: long names differ only at the end (grip, cable position). */}
        <h1 className="mb-3 text-xl font-bold leading-tight wrap-break-word">{exercise.exerciseName}</h1>

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
            <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
              {exercise.imageUrl ? (
                <Image src={exercise.imageUrl} alt={exercise.exerciseName} fill sizes="56px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  <GLoad className="size-5" />
                </div>
              )}
            </div>
            <p className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted">
              <span className="text-sm font-semibold text-foreground">
                <span className="whitespace-nowrap">
                  {exercise.prescribedSets} {exercise.prescribedSets === 1 ? "série" : "séries"}
                </span>{" "}
                <span className="whitespace-nowrap">
                  × {exercise.repMin}–{exercise.repMax} reps
                </span>
              </span>
              {exercise.rirTarget != null ? (
                <span className="whitespace-nowrap">RIR {formatDecimal(exercise.rirTarget)}</span>
              ) : null}
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

        <div className="mt-3 flex items-center gap-3">
          <Link
            href={`/app/exercises/${exercise.exerciseSlug}`}
            className="-mx-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs text-accent hover:underline"
          >
            <Info className="size-3.5" />
            Ver técnica
          </Link>
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
              className={`-mx-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs ${
                confirmSkip ? "font-semibold text-danger" : "text-muted hover:text-foreground"
              }`}
            >
              <SkipForward className="size-3.5" />
              {confirmSkip ? "Confirmar pular?" : "Pular exercício"}
            </button>
          )}
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
          <p className="mt-3 border-l-2 border-l-accent bg-surface-2 px-3 py-2 text-xs text-foreground/90">
            {exercise.notes}
          </p>
        ) : null}

        {exercise.previousSets.length > 0 ? (
          <div className="mt-4 border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Último treino</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
              {exercise.previousSets.map((s, i) => (
                <span key={i} className={s.isExtra ? "text-muted" : undefined}>
                  {s.isExtra ? "+" : ""}
                  {formatDecimal(s.weightKg) || "—"}kg × {s.reps ?? "—"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <SetTable
            warmups={rows.warmups}
            prescribed={rows.prescribed}
            extras={rows.extras}
            prescribedCount={rows.prescribed.length}
            onChange={changeField}
            onBlurRow={blurRow}
            onToggle={toggleRow}
            onRemoveExtra={removeExtra}
            onAddExtra={addExtra}
            addingExtra={addingExtra}
          />
        </div>

        {exerciseError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {exerciseError}
          </p>
        ) : null}

        {/* Clears the rest bar when brought into view after the last set. */}
        {isLast ? (
          <Button ref={ctaRef} className="mt-6 w-full scroll-mb-40" size="lg" variant="strong" onClick={openSheet}>
            <GCheck className="size-4" />
            Finalizar treino
          </Button>
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

        <div className="mt-8 border-t border-border pt-5">
          <label htmlFor="exercise-note" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <GNotes className="size-3.5" />
            Nota do exercício/máquina
          </label>
          <textarea
            key={exercise.exerciseId}
            id="exercise-note"
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
            onBlur={() => saveNote(exercise.exerciseId, exercise.persistentNote)}
            placeholder="Ex.: banco na posição 4"
            // 16px on phones: iOS zooms into smaller fields on focus.
            className="mt-1.5 w-full rounded-[3px] border border-foreground/50 bg-surface px-3 py-2 text-base sm:text-sm"
            rows={2}
          />
          <div aria-live="polite" className="mt-1 flex min-h-5 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
            {note?.state === "saving" ? (
              <span className="text-muted">Salvando nota…</span>
            ) : note?.state === "saved" && note.text === noteValue ? (
              <span className="text-success">Nota salva</span>
            ) : note?.state === "error" ? (
              <>
                <span className="text-danger">Nota não salva — sem conexão?</span>
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
        </div>
      </div>

      {rest.timer ? (
        <RestTimerBar
          key={rest.timer.id}
          timer={rest.timer}
          sound={session.restTimerSound}
          next={restNext}
          upNext={upNextText(rows)}
          onAdjust={rest.adjust}
          onTogglePause={rest.togglePause}
          onDismiss={rest.dismiss}
          onAnnounce={announce}
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
          onClose={() => {
            setSheetOpen(false);
            setFinishError(null);
          }}
        />
      ) : null}
    </div>
  );
}
