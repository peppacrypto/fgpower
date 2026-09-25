"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, unstable_isUnrecognizedActionError } from "next/navigation";
import { ChevronLeft, ChevronRight, Info, SkipForward, Undo2, X } from "lucide-react";
import { GLoad, GNotes, GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import {
  addExtraSet,
  discardWorkoutSession,
  finishWorkoutSession,
  logSet,
  removeSet,
  saveSetValues,
  skipExercise,
  uncompleteSet,
  type LogSetInput,
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
import { FIELD_LABEL, SetTable, rowName, type DraftField, type SetTableRowModel } from "./set-table";
import { FinishSheet, type FinishStats } from "./finish-sheet";
import { RestTimerBar, useRestTimer } from "./rest-timer";
import type { ExecutionExerciseLog, ExecutionSession, ExecutionSetLog } from "./types";

type RowValues = Record<DraftField, string>;
/**
 * What the user typed in a row (untouched fields show the saved value).
 * `dirty` = not yet confirmed by the server: only those are resent (autosave,
 * finish), mirrored locally and restored. A confirmed draft keeps showing
 * until fresh server data arrives — `basis` is the session prop it was
 * confirmed against — and then the server copy wins, so a correction made on
 * another device shows up here instead of being overwritten from here.
 */
interface Draft {
  values: Partial<RowValues>;
  dirty: boolean;
  basis: ExecutionSession | null;
}
type Drafts = Record<string, Draft>;
type StoredDrafts = Record<string, Partial<RowValues>>;

const FIELDS: DraftField[] = ["weight", "reps", "rir"];
const SAVE_FAILED = "Não salvou — sem conexão? Toque ✓ de novo.";

function useElapsedTime(startedAtIso: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAtIso).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAtIso]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function formatRest(seconds: number) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds}s`;
}

// Typed values are mirrored locally so a reload, a dead tab or a lost
// connection never costs what the user already entered.
const storageKey = (sessionId: string) => `fg:workout-drafts:${sessionId}`;
function readStoredDrafts(sessionId: string): StoredDrafts {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(sessionId)) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as StoredDrafts) : {};
  } catch {
    return {};
  }
}
/** Mirrors only the unconfirmed edits. */
function writeStoredDrafts(sessionId: string, drafts: Drafts) {
  try {
    const dirty: StoredDrafts = {};
    for (const [id, d] of Object.entries(drafts)) if (d.dirty) dirty[id] = d.values;
    if (Object.keys(dirty).length === 0) window.localStorage.removeItem(storageKey(sessionId));
    else window.localStorage.setItem(storageKey(sessionId), JSON.stringify(dirty));
  } catch {
    /* storage unavailable (private mode) — drafts still live in memory */
  }
}

function savedValues(set: ExecutionSetLog): RowValues {
  return { weight: formatDecimal(set.weightKg), reps: formatDecimal(set.reps), rir: formatDecimal(set.rir) };
}
/** The draft still in force for a row: unconfirmed, or confirmed against the data on screen. */
function activeDraft(id: string, drafts: Drafts, current: ExecutionSession): Partial<RowValues> | undefined {
  const d = drafts[id];
  return d && (d.dirty || d.basis === current) ? d.values : undefined;
}
function shownValues(set: ExecutionSetLog, drafts: Drafts, current: ExecutionSession): RowValues {
  const base = savedValues(set);
  const d = activeDraft(set.id, drafts, current);
  return d ? { weight: d.weight ?? base.weight, reps: d.reps ?? base.reps, rir: d.rir ?? base.rir } : base;
}
function parseRow(v: RowValues) {
  return { weightKg: parseDecimalInput(v.weight), reps: parseDecimalInput(v.reps), rir: parseDecimalInput(v.rir) };
}
function isFilled(v: RowValues) {
  const p = parseRow(v);
  return p.weightKg !== null && p.reps !== null && p.reps >= 1;
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
  done: Record<string, boolean>,
  saving: Record<string, boolean>,
  errors: Record<string, string>,
): ExerciseRows {
  const plan = planRows(ex.sets);
  let above: SuggestedValues | null = null;
  const toModel = (r: (typeof plan.prescribed)[number]): SetTableRowModel => {
    const values = shownValues(r.set, drafts, current);
    const suggestion = suggestFor(r.kind, r.ordinal, above, ex.previousSets);
    const p = parseRow(values);
    if (r.kind !== "WARMUP" && p.weightKg !== null) above = { weightKg: p.weightKg, reps: p.reps ?? suggestion.reps };
    const isDone = done[r.set.id] ?? r.set.isCompleted;
    const hasW = values.weight.trim() !== "";
    const hasR = values.reps.trim() !== "";
    return {
      id: r.set.id,
      kind: r.kind,
      ordinal: r.ordinal,
      values,
      suggestion,
      done: isDone,
      saving: saving[r.set.id] === true,
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

export function WorkoutExecutionClient({ session }: { session: ExecutionSession }) {
  const router = useRouter();
  const total = session.exercises.length;
  const [exerciseIndex, setExerciseIndex] = useState(() => {
    // Reopening a workout lands on the first exercise still to do.
    const i = session.exercises.findIndex((ex) => !isExerciseDone(ex.sets, ex.wasSkipped));
    return i >= 0 ? i : Math.max(0, total - 1);
  });
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [addingExtra, setAddingExtra] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showNotice, setShowNotice] = useState(session.notice !== null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, startFinishing] = useTransition();
  const [discarding, startDiscarding] = useTransition();
  const [, startTransition] = useTransition();
  const lastSent = useRef<Record<string, string>>({});
  /** Set when a background autosave hit a stale build; the next explicit action reloads. */
  const staleBuild = useRef(false);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** A box to bring into view after the next render ("Revisar" in the finish sheet). */
  const pendingFocus = useRef<string | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const timer = useRestTimer();
  const elapsed = useElapsedTime(session.startedAtIso);

  const serverDone = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const ex of session.exercises) for (const s of ex.sets) map[s.id] = s.isCompleted;
    return map;
  }, [session]);
  const [done, setDoneOptimistic] = useOptimistic(serverDone, (cur, u: { id: string; value: boolean }) => ({
    ...cur,
    [u.id]: u.value,
  }));

  // Restore anything typed before a reload / tab kill, then keep the mirror current.
  const restored = useRef(false);
  useEffect(() => {
    const stored = readStoredDrafts(session.id);
    // One-time restore from localStorage, which only exists after hydration.
    if (Object.keys(stored).length > 0) {
      const restoredDrafts: Drafts = {};
      for (const [id, values] of Object.entries(stored)) restoredDrafts[id] = { values, dirty: true, basis: null };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external store on mount
      setDrafts((d) => ({ ...restoredDrafts, ...d }));
    }
    restored.current = true;
  }, [session.id]);
  useEffect(() => {
    if (restored.current) writeStoredDrafts(session.id, drafts);
  }, [drafts, session.id]);

  const rowsByExercise = useMemo(
    () => session.exercises.map((ex) => buildRows(ex, drafts, session, done, saving, rowErrors)),
    [session, drafts, done, saving, rowErrors],
  );

  const setById = useMemo(() => {
    const map = new Map<string, { set: ExecutionSetLog; ex: ExecutionExerciseLog }>();
    for (const ex of session.exercises) for (const s of ex.sets) map.set(s.id, { set: s, ex });
    return map;
  }, [session.exercises]);

  const exercise = session.exercises[exerciseIndex];
  const rows = rowsByExercise[exerciseIndex];

  useEffect(() => {
    const label = pendingFocus.current;
    if (!label) return;
    pendingFocus.current = null;
    const el = Array.from(document.querySelectorAll<HTMLInputElement>("input[aria-label]")).find(
      (input) => input.getAttribute("aria-label") === label,
    );
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (!confirmSkip) return;
    const t = setTimeout(() => setConfirmSkip(false), 4000);
    return () => clearTimeout(t);
  }, [confirmSkip]);

  /**
   * A new build was deployed mid-workout: reload to pick it up. Typed values
   * are already mirrored to localStorage by the effect above and restored.
   */
  function recoverFromStaleBuild(err: unknown) {
    if (unstable_isUnrecognizedActionError(err)) {
      window.location.reload();
      return true;
    }
    return false;
  }

  function goTo(i: number) {
    setExerciseIndex(Math.max(0, Math.min(total - 1, i)));
    setConfirmSkip(false);
    setShowOverview(false);
    setExerciseError(null);
    window.scrollTo({ top: 0 });
  }

  function setRowError(id: string, message: string | null) {
    setRowErrors((e) => {
      const next = { ...e };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  /**
   * Sends a row's typed values to the server (not marking it done). `typing`
   * saves in the background while the user types and leaves a done row that
   * is momentarily incomplete alone (they may be retyping its reps).
   */
  function autosave(id: string, currentDrafts: Drafts, typing = false) {
    const entry = setById.get(id);
    const draft = currentDrafts[id];
    if (!entry || !draft?.dirty || staleBuild.current) return;
    const values = shownValues(entry.set, currentDrafts, session);
    const wasDone = done[id] ?? entry.set.isCompleted;
    if (wasDone && !isFilled(values)) {
      if (typing) return;
      setRowError(id, "Preencha kg e reps — sem eles a série deixa de contar.");
    }
    const key = FIELDS.map((f) => values[f]).join("|");
    if (key === lastSent.current[id]) return;
    lastSent.current[id] = key;
    const basis = session;
    saveSetValues({ setLogId: id, ...parseRow(values) })
      .then((r) => {
        if (r.ok) confirmDraft(id, draft.values, basis);
        else if (r.reason === "CLOSED") router.refresh();
      })
      .catch((err) => {
        delete lastSent.current[id];
        // Don't reload under the user's fingers mid-field; the next ✓/Finalizar will.
        if (unstable_isUnrecognizedActionError(err)) staleBuild.current = true;
      });
  }

  /** The server has these values: stop resending them (unless typed over since). */
  function confirmDraft(id: string, values: Partial<RowValues>, basis: ExecutionSession) {
    setDrafts((d) => (d[id]?.values === values ? { ...d, [id]: { values, dirty: false, basis } } : d));
  }

  function changeField(id: string, field: DraftField, value: string) {
    const base = activeDraft(id, drafts, session) ?? {};
    const next: Drafts = { ...drafts, [id]: { values: { ...base, [field]: value }, dirty: true, basis: null } };
    setDrafts(next);
    if (rowErrors[id]) setRowError(id, null);
    clearTimeout(typingTimers.current[id]);
    typingTimers.current[id] = setTimeout(() => autosave(id, next, true), 1200);
  }

  function blurRow(id: string) {
    clearTimeout(typingTimers.current[id]);
    autosave(id, drafts);
  }

  // Leaving the app (switching apps, locking the phone, back gesture) saves
  // whatever is typed, so Today and other devices see it.
  const flushRef = useRef<() => void>(() => {});
  const unloadRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      for (const id of Object.keys(drafts)) {
        if (!drafts[id].dirty) continue;
        clearTimeout(typingTimers.current[id]);
        autosave(id, drafts, true);
      }
    };
    unloadRef.current = () => {
      // A server action can't start while the page unloads; a keepalive request can.
      const rows = Object.keys(drafts)
        .filter((id) => drafts[id].dirty && setById.has(id))
        .map((id) => ({ setLogId: id, ...parseRow(shownValues(setById.get(id)!.set, drafts, session)) }));
      if (rows.length === 0 || staleBuild.current) return;
      try {
        void fetch("/api/workout/autosave", {
          method: "POST",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rows }),
        });
      } catch {
        /* the local mirror still has them */
      }
    };
  });
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushRef.current();
    };
    const onPageHide = () => unloadRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flushRef.current();
    };
  }, []);

  function toggleRow(id: string) {
    const entry = setById.get(id);
    const row = [...rows.warmups, ...rows.prescribed, ...rows.extras].find((r) => r.id === id);
    if (!entry || !row || row.saving) return;
    clearTimeout(typingTimers.current[id]);
    setRowError(id, null);

    if (row.done) {
      startTransition(async () => {
        setDoneOptimistic({ id, value: false });
        try {
          const r = await uncompleteSet(id);
          if (!r.ok) router.refresh();
        } catch (err) {
          if (!recoverFromStaleBuild(err)) setRowError(id, "Não foi possível desfazer — sem conexão?");
        }
      });
      return;
    }

    // ✓ on an empty box takes the grey suggestion (last time / the row above).
    const typed = parseRow(row.values);
    const weightKg = typed.weightKg ?? row.suggestion.weightKg;
    const reps = typed.reps ?? row.suggestion.reps;
    if (weightKg === null || reps === null || reps < 1) {
      setRowError(id, "Preencha kg e reps.");
      return;
    }
    const committed = { weight: formatDecimal(weightKg), reps: formatDecimal(Math.round(reps)), rir: row.values.rir };
    const basis = session;
    setDrafts((d) => ({ ...d, [id]: { values: committed, dirty: true, basis: null } }));
    lastSent.current[id] = FIELDS.map((f) => committed[f]).join("|");
    setSaving((s) => ({ ...s, [id]: true }));
    startTransition(async () => {
      setDoneOptimistic({ id, value: true });
      try {
        const r = await logSet({ setLogId: id, weightKg, reps: Math.round(reps), rir: typed.rir });
        if (r.ok) {
          confirmDraft(id, committed, basis);
          if (row.kind !== "WARMUP") timer.start(entry.ex.restSeconds);
        } else if (r.reason === "CLOSED") {
          router.refresh();
        } else {
          setRowError(id, "Valores inválidos — confira kg e reps.");
        }
      } catch (err) {
        delete lastSent.current[id];
        if (!recoverFromStaleBuild(err)) setRowError(id, SAVE_FAILED);
      } finally {
        setSaving((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      }
    });
  }

  function runExerciseAction(action: () => Promise<{ ok: boolean; reason?: string }>, failure: string, after?: () => void) {
    setExerciseError(null);
    startTransition(async () => {
      try {
        const r = await action();
        if (!r.ok) {
          if (r.reason === "CLOSED") router.refresh();
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
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    runExerciseAction(() => removeSet(id), "Não foi possível remover a série extra.");
  }

  /**
   * What this device typed, sent with the finish. Only local edits: rows filled
   * elsewhere are completed by the server from its own copy, and resending this
   * screen's older values could overwrite a correction made on another device.
   * A skipped exercise sends only rows already ✓'d.
   */
  function collectPending(): LogSetInput[] {
    const pending: LogSetInput[] = [];
    for (const id of Object.keys(drafts)) {
      const entry = setById.get(id);
      if (!entry || !drafts[id].dirty) continue;
      if (entry.ex.wasSkipped && !(done[id] ?? entry.set.isCompleted)) continue;
      pending.push({ setLogId: id, ...parseRow(shownValues(entry.set, drafts, session)) });
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
    router.refresh();
    setSheetOpen(true);
  }

  function finish() {
    setFinishError(null);
    const pending = collectPending();
    startFinishing(async () => {
      try {
        const r = await finishWorkoutSession(session.id, pending);
        if (r.ok) {
          writeStoredDrafts(session.id, {});
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

  function discard() {
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
          router.refresh();
          return;
        }
        writeStoredDrafts(session.id, {});
        router.replace("/app/today");
      } catch (err) {
        if (!recoverFromStaleBuild(err)) setFinishError("Não foi possível descartar — sem conexão?");
      }
    });
  }

  if (!exercise || !rows) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-semibold">Nenhum exercício neste treino.</p>
        <Button asChild>
          <Link href="/app/today">Voltar</Link>
        </Button>
      </div>
    );
  }

  const complete = rowsComplete(rows, exercise.wasSkipped);
  const isLast = exerciseIndex === total - 1;
  const noteValue = noteDrafts[exercise.exerciseId] ?? exercise.persistentNote ?? "";

  return (
    <div className="flex min-h-dvh flex-col pb-40">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
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
                Exercício {exerciseIndex + 1} de {total} · {elapsed}{" "}
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
                        <span className="tag tag--mark shrink-0 text-[9px]">Pulado</span>
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
            className="flex size-11 shrink-0 items-center justify-center rounded-[3px] border border-border disabled:opacity-30"
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

        {isLast ? (
          <Button className="mt-6 w-full" size="lg" variant="strong" onClick={openSheet}>
            <GCheck className="size-4" />
            Finalizar treino
          </Button>
        ) : (
          <Button
            className="mt-6 w-full"
            size="lg"
            variant={complete ? "primary" : "outline"}
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
            id="exercise-note"
            value={noteValue}
            onChange={(e) => setNoteDrafts((n) => ({ ...n, [exercise.exerciseId]: e.target.value }))}
            onBlur={() => {
              const draft = noteDrafts[exercise.exerciseId];
              if (draft === undefined || draft === (exercise.persistentNote ?? "") || staleBuild.current) return;
              saveExerciseNote(exercise.exerciseId, draft).catch((err) => {
                if (unstable_isUnrecognizedActionError(err)) staleBuild.current = true;
              });
            }}
            placeholder="Ex.: banco na posição 4"
            className="mt-1.5 w-full rounded-[3px] border border-border bg-surface px-3 py-2 text-sm"
            rows={2}
          />
        </div>
      </div>

      {timer.isRunning && timer.secondsLeft !== null ? (
        <RestTimerBar
          secondsLeft={timer.secondsLeft}
          paused={timer.paused}
          onAdd={timer.addSeconds}
          onSkip={timer.skip}
          onTogglePause={timer.togglePause}
        />
      ) : null}

      {sheetOpen ? (
        <FinishSheet
          key={sheetKey}
          stats={stats}
          finishing={finishing}
          discarding={discarding}
          error={finishError}
          onFinish={finish}
          onDiscard={discard}
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
