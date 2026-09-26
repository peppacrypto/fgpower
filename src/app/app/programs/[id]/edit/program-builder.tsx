"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter, unstable_isUnrecognizedActionError } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import {
  saveProgram,
  type BuilderDay,
  type BuilderExercise,
  type SaveProgramResult,
} from "@/lib/actions/program-builder";
import {
  BUILDER_FIELD_LABELS,
  BUILDER_LIMITS,
  DAY_NAME_MAX,
  MAX_DAY_EXERCISES,
  MAX_PROGRAM_DAYS,
  PROGRAM_DESCRIPTION_MAX,
  PROGRAM_NAME_MAX,
  validateBuilderProgram,
  type BuilderFieldError,
  type BuilderNumberField,
} from "@/lib/validation/program-builder";
import { ExercisePicker, type PickerExercise } from "./exercise-picker";
import { ExerciseRow, type RowErrors } from "./exercise-row";
import { LeaveSheet } from "./leave-sheet";

interface EditableExercise extends BuilderExercise {
  rowId: string;
}
interface EditableDay extends Omit<BuilderDay, "exercises"> {
  /** Client-only identity (new days have no id until saved). */
  key: string;
  exercises: EditableExercise[];
}
interface ProgramState {
  name: string;
  description: string;
  days: BuilderDay[];
}

const EMPTY_DAY: BuilderDay = { name: "Dia 1", focus: null, exercises: [] };

/** `makeId` gives client-only keys; they end up in the DOM (data-row-id), so
 * the first render must produce the same ones on the server and the client. */
function toEditable(days: BuilderDay[], makeId: (prefix: string) => string): EditableDay[] {
  return (days.length ? days : [EMPTY_DAY]).map((d) => ({
    id: d.id,
    name: d.name,
    focus: d.focus,
    key: makeId("day"),
    exercises: d.exercises.map((e) => ({ ...e, rowId: makeId("row") })),
  }));
}

/** The payload the server gets — also the unit of "dirty" and of the local draft. */
function toState(name: string, description: string, days: EditableDay[]): ProgramState {
  return {
    name,
    description,
    days: days.map((d) => ({
      id: d.id,
      name: d.name,
      focus: d.focus,
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        groupKey: e.groupKey,
        sets: e.sets,
        repMin: e.repMin,
        repMax: e.repMax,
        rirTarget: e.rirTarget,
        restSeconds: e.restSeconds,
        warmupSets: e.warmupSets,
        loadTargetKg: e.loadTargetKg,
        notes: e.notes,
      })),
    })),
  };
}

// Unsaved edits are mirrored locally (like fg:workout-drafts) so a reload, a
// killed tab or a back-swipe never costs a program built on the phone.
interface StoredDraft {
  v: 1;
  /** The tab that wrote it (absent in older drafts), so another tab's save leaves it alone. */
  tab?: string;
  savedAt: number;
  /** The program's updatedAt the draft was made against. */
  base: string;
  program: ProgramState;
}
const draftKey = (programId: string) => `fg:program-draft:${programId}`;
function readDraft(programId: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(programId));
    if (!raw) return null;
    const d = JSON.parse(raw) as StoredDraft;
    const p = d?.program;
    const valid =
      d?.v === 1 &&
      typeof p?.name === "string" &&
      typeof p.description === "string" &&
      Array.isArray(p.days) &&
      p.days.every(
        (day) =>
          typeof day?.name === "string" &&
          Array.isArray(day.exercises) &&
          day.exercises.every((ex) => typeof ex?.exerciseId === "string"),
      );
    return valid ? d : null;
  } catch {
    return null;
  }
}
function writeDraft(programId: string, draft: StoredDraft) {
  try {
    window.localStorage.setItem(draftKey(programId), JSON.stringify(draft));
  } catch {
    /* storage unavailable (private mode) — the edits still live in memory */
  }
}
function clearDraft(programId: string) {
  try {
    window.localStorage.removeItem(draftKey(programId));
  } catch {
    /* nothing stored */
  }
}
/** Removes the stored draft only when `removable` agrees (unreadable ones always go). */
function clearDraftIf(programId: string, removable: (draft: StoredDraft) => boolean) {
  const stored = readDraft(programId);
  if (!stored || removable(stored)) clearDraft(programId);
}

// The draft slot is per program, not per tab: a save or discard in one tab
// must not delete the unsaved edits another open tab mirrored there.
let tabId: string | null = null;
const thisTab = () => (tabId ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const isOwnDraft = (draft: StoredDraft) => !draft.tab || draft.tab === thisTab();

/** Where a save-bar line points, so the line goes away once that error is fixed. */
type ErrorRef =
  | { kind: "name" }
  | { kind: "description" }
  | { kind: "day"; key: string }
  | { kind: "row"; rowId: string; field: BuilderNumberField }
  /** Form-level problem: only the next save clears it. */
  | { kind: "form" };

interface BuilderErrors {
  rows: Record<string, RowErrors>;
  days: Record<string, string>;
  name: string | null;
  description: string | null;
  /** The last save's problems in order; the save bar names the first still open. */
  items: { ref: ErrorRef; text: string }[];
  /** A save-bar message not tied to a field (offline, expired session). */
  message: string | null;
}
const NO_ERRORS: BuilderErrors = { rows: {}, days: {}, name: null, description: null, items: [], message: null };

function isOpen(e: BuilderErrors, ref: ErrorRef) {
  switch (ref.kind) {
    case "name":
      return !!e.name;
    case "description":
      return !!e.description;
    case "day":
      return !!e.days[ref.key];
    case "row":
      return !!e.rows[ref.rowId]?.[ref.field];
    case "form":
      return true;
  }
}

function saveBarSummary(e: BuilderErrors): string | null {
  if (e.message) return e.message;
  const open = e.items.filter((item) => isOpen(e, item.ref));
  if (!open.length) return null;
  return `Corrija antes de salvar — ${open[0].text}${open.length > 1 ? ` (e mais ${open.length - 1})` : ""}`;
}
const NAME_REQUIRED = "Dê um nome ao programa.";

const draftTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function ProgramBuilder({
  programId,
  programName,
  programDescription,
  initialDays,
  version,
}: {
  programId: string;
  programName: string;
  programDescription: string;
  initialDays: BuilderDay[];
  /** The program's updatedAt (ISO), to tell whether a local draft predates a save. */
  version: string;
}) {
  const router = useRouter();
  const [initial] = useState(() => {
    let n = 0;
    const days = toEditable(initialDays, (prefix) => `${prefix}-${n++}`);
    return { days, key: JSON.stringify(toState(programName, programDescription, days)) };
  });
  const [name, setName] = useState(programName);
  const [description, setDescription] = useState(programDescription);
  const [days, setDays] = useState<EditableDay[]>(initial.days);
  const [baseline, setBaseline] = useState(initial.key);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [savedOnce, setSavedOnce] = useState(false);
  const [errors, setErrors] = useState<BuilderErrors>(NO_ERRORS);
  const [draftOffer, setDraftOffer] = useState<StoredDraft | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  const current = useMemo(() => toState(name, description, days), [name, description, days]);
  const currentKey = useMemo(() => JSON.stringify(current), [current]);
  const dirty = currentKey !== baseline;
  /** The editor state as of the last commit: a save reads this, not its render's closure. */
  const latest = useRef({ name, description, days });
  useLayoutEffect(() => {
    latest.current = { name, description, days };
  });

  /** Set once the user chose to leave: no more guards or draft writes. */
  const leaving = useRef(false);
  /** Mount-time draft read done; a draft still waiting for restore/discard. */
  const draftChecked = useRef(false);
  const pendingDraft = useRef<StoredDraft | null>(null);
  /** CSS selector to focus after the next render (error field, moved row). */
  const pendingFocus = useRef<string | null>(null);
  const idSeq = useRef(0);
  const newId = (prefix: string) => `${prefix}-n${++idSeq.current}`;

  const sensors = useSensors(
    // Mouse and touch separately: the touch sensor waits for a press (so a
    // swipe elsewhere still scrolls) and the grip is touch-none, so holding it
    // drags instead of scrolling the page.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeDay = days[activeDayIndex] ?? days[0];

  // One-time look for unsaved edits from an earlier visit.
  useEffect(() => {
    const stored = readDraft(programId);
    if (stored && JSON.stringify(stored.program) !== initial.key) {
      pendingDraft.current = stored;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external store on mount
      setDraftOffer(stored);
    } else if (stored) {
      clearDraft(programId);
    }
    draftChecked.current = true;
  }, [programId, initial.key]);

  // Keep the local draft in step with the editor.
  useEffect(() => {
    if (!draftChecked.current || leaving.current) return;
    if (dirty) writeDraft(programId, { v: 1, tab: thisTab(), savedAt: Date.now(), base: version, program: current });
    else if (!pendingDraft.current) clearDraftIf(programId, isOwnDraft);
  }, [dirty, current, programId, version]);

  // While there are unsaved changes: the browser asks before a reload/close,
  // and in-app links open the "Sair sem salvar?" sheet instead of leaving.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      // Other sites load a new page: beforeunload covers them.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // Capture phase on window runs before Next's <Link> handler (React
      // listens on the document), so the navigation never starts.
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  useEffect(() => {
    const selector = pendingFocus.current;
    if (!selector) return;
    pendingFocus.current = null;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    if (el.matches("input, textarea")) el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: !el.matches("input, textarea") });
  });

  // ---------------------------------------------------------------- edits

  function patchDays(fn: (prev: EditableDay[]) => EditableDay[]) {
    setDays(fn);
    setSavedOnce(false);
  }

  function patchActiveExercises(fn: (list: EditableExercise[]) => EditableExercise[]) {
    const key = activeDay.key;
    patchDays((prev) => prev.map((d) => (d.key === key ? { ...d, exercises: fn(d.exercises) } : d)));
  }

  function renameDay(value: string) {
    const key = activeDay.key;
    patchDays((prev) => prev.map((d) => (d.key === key ? { ...d, name: value } : d)));
    if (errors.days[key]) setErrors((e) => ({ ...e, days: omit(e.days, key) }));
  }

  function addDay() {
    if (days.length >= MAX_PROGRAM_DAYS) return;
    const key = newId("day");
    patchDays((prev) => [...prev, { key, name: `Dia ${prev.length + 1}`, focus: null, exercises: [] }]);
    setActiveDayIndex(days.length);
  }

  function removeDay(index: number) {
    const removed = days[index];
    patchDays((prev) => prev.filter((_, i) => i !== index));
    setActiveDayIndex((i) => Math.max(0, Math.min(days.length - 2, i)));
    // Its errors go with it (and so do their save-bar lines).
    if (removed && dayHasErrors(removed)) {
      setErrors((e) => {
        const rows = { ...e.rows };
        for (const ex of removed.exercises) delete rows[ex.rowId];
        return { ...e, rows, days: omit(e.days, removed.key) };
      });
    }
  }

  function moveDay(index: number, delta: number) {
    patchDays((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveDayIndex((i) => (i === index ? Math.max(0, Math.min(days.length - 1, i + delta)) : i));
  }

  function addExercise(picked: PickerExercise) {
    if (activeDay.exercises.length >= MAX_DAY_EXERCISES) return;
    const newEx: EditableExercise = {
      rowId: newId("row"),
      exerciseId: picked.id,
      exerciseName: picked.namePt,
      groupKey: null,
      sets: 3,
      repMin: 8,
      repMax: 12,
      rirTarget: 2,
      restSeconds: 120,
      warmupSets: 0,
      loadTargetKg: null,
      notes: null,
    };
    patchActiveExercises((list) => [...list, newEx]);
  }

  function updateExercise(rowId: string, patch: Partial<BuilderExercise>) {
    const before = activeDay.exercises.find((e) => e.rowId === rowId);
    patchActiveExercises((list) => list.map((e) => (e.rowId === rowId ? { ...e, ...patch } : e)));
    const rowErrors = errors.rows[rowId];
    if (!rowErrors || !before) return;
    const after = { ...before, ...patch };
    // Editing a field clears its error (blur settles the value). The range
    // error sits on the min, so it also clears once the max puts it right.
    const fixed = (Object.keys(rowErrors) as BuilderNumberField[]).filter(
      (f) => f in patch || (f === "repMin" && "repMax" in patch && after.repMin <= after.repMax),
    );
    if (!fixed.length) return;
    setErrors((e) => {
      const left = { ...e.rows[rowId] };
      for (const f of fixed) delete left[f];
      const rows = Object.keys(left).length ? { ...e.rows, [rowId]: left } : omit(e.rows, rowId);
      return { ...e, rows };
    });
  }

  function removeExercise(rowId: string) {
    patchActiveExercises((list) => list.filter((e) => e.rowId !== rowId));
    if (errors.rows[rowId]) setErrors((e) => ({ ...e, rows: omit(e.rows, rowId) }));
  }

  function duplicateExercise(rowId: string) {
    if (activeDay.exercises.length >= MAX_DAY_EXERCISES) return;
    const copyId = newId("row");
    patchActiveExercises((list) => {
      const idx = list.findIndex((e) => e.rowId === rowId);
      if (idx === -1) return list;
      const next = [...list];
      next.splice(idx + 1, 0, { ...list[idx], rowId: copyId });
      return next;
    });
  }

  function moveExercise(rowId: string, delta: -1 | 1) {
    patchActiveExercises((list) => {
      const from = list.findIndex((e) => e.rowId === rowId);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= list.length) return list;
      return arrayMove(list, from, to);
    });
    // Keep focus on the arrow that was pressed (the row's DOM node moves);
    // at the edge the arrow disables, so fall back to the other one.
    const index = activeDay.exercises.findIndex((e) => e.rowId === rowId) + delta;
    const atEdge = index <= 0 || index >= activeDay.exercises.length - 1;
    const dir = delta < 0 ? (atEdge ? "down" : "up") : atEdge ? "up" : "down";
    pendingFocus.current = `[data-row-id="${rowId}"] [data-move="${dir}"]`;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    patchActiveExercises((list) => {
      const oldIndex = list.findIndex((e) => e.rowId === active.id);
      const newIndex = list.findIndex((e) => e.rowId === over.id);
      return oldIndex === -1 || newIndex === -1 ? list : arrayMove(list, oldIndex, newIndex);
    });
  }

  // ---------------------------------------------------------------- draft

  function restoreDraft() {
    const draft = pendingDraft.current ?? draftOffer;
    if (!draft) return;
    const p = draft.program;
    setName(p.name);
    setDescription(p.description);
    setDays(toEditable(p.days, newId));
    setActiveDayIndex(0);
    setErrors(NO_ERRORS);
    setSavedOnce(false);
    pendingDraft.current = null;
    setDraftOffer(null);
  }

  function dismissDraft() {
    const offered = pendingDraft.current ?? draftOffer;
    pendingDraft.current = null;
    setDraftOffer(null);
    // Edits made while the offer was up already took the slot: keep mirroring
    // them (the sync effect won't rerun until the next edit). Otherwise drop
    // the offered draft — unless another tab has written a newer one since.
    if (dirty) writeDraft(programId, { v: 1, tab: thisTab(), savedAt: Date.now(), base: version, program: current });
    else clearDraftIf(programId, (d) => d.savedAt === offered?.savedAt);
  }

  // ---------------------------------------------------------------- save

  /** Maps validation problems onto the rows/days on screen and jumps to the first. */
  function showErrors(list: BuilderFieldError[], snapshot: EditableDay[]) {
    const next: BuilderErrors = { ...NO_ERRORS, rows: {}, days: {}, items: [] };
    let focus: { selector: string; dayKey?: string } | null = null;
    for (const err of list) {
      if (err.field === "name" || err.field === "description") {
        next[err.field] = err.message;
        next.items.push({ ref: { kind: err.field }, text: err.message });
        focus ??= { selector: `#program-${err.field}` };
        continue;
      }
      const day = err.dayIndex !== null ? snapshot[err.dayIndex] : undefined;
      const row = day && err.exerciseIndex !== null ? day.exercises[err.exerciseIndex] : undefined;
      if (day && row && err.field in BUILDER_LIMITS) {
        const field = err.field as BuilderNumberField;
        next.rows[row.rowId] = { ...next.rows[row.rowId], [field]: err.message };
        next.items.push({
          ref: { kind: "row", rowId: row.rowId, field },
          text: `${BUILDER_FIELD_LABELS[field]} em ${row.exerciseName ?? "exercício"}: ${err.message}`,
        });
        focus ??= { selector: `[data-row-id="${row.rowId}"] input[data-field="${field}"]`, dayKey: day.key };
        continue;
      }
      if (day) {
        next.days[day.key] = err.message;
        focus ??= { selector: "#day-name", dayKey: day.key };
      }
      next.items.push({
        ref: day ? { kind: "day", key: day.key } : { kind: "form" },
        text: day ? `${day.name}: ${err.message}` : err.message,
      });
    }
    if (!next.items.length) next.message = "Não foi possível salvar.";
    setErrors(next);
    if (focus) {
      const { selector, dayKey } = focus;
      const dayIndex = dayKey ? latest.current.days.findIndex((d) => d.key === dayKey) : -1;
      if (dayIndex >= 0) setActiveDayIndex(dayIndex);
      pendingFocus.current = selector;
    }
  }

  /**
   * A number box commits on blur. Tapping Salvar blurs it first in most
   * browsers, but not all (nor a programmatic click): blur it here and let
   * that commit render, so the save sends what is on screen.
   */
  function commitFocusedField() {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && el.dataset.field) flushSync(() => el.blur());
  }

  async function save(): Promise<boolean> {
    const { name, description, days: snapshot } = latest.current;
    const payload = toState(name, description, snapshot);
    const local = validateBuilderProgram(payload);
    if (!local.ok) {
      showErrors(local.errors, snapshot);
      return false;
    }
    let result: SaveProgramResult;
    try {
      result = await saveProgram(programId, payload);
    } catch (err) {
      if (unstable_isUnrecognizedActionError(err)) {
        // A new build was deployed: reload to pick it up. The edits are in
        // the local draft and offered back after the reload.
        leaving.current = true;
        window.location.reload();
        return false;
      }
      setErrors({ ...NO_ERRORS, message: "Sem conexão com o servidor. Suas alterações continuam aqui — tente de novo." });
      return false;
    }
    if (!result.ok) {
      if (result.errors.length) showErrors(result.errors, snapshot);
      else setErrors({ ...NO_ERRORS, message: result.message ?? "Não foi possível salvar." });
      return false;
    }

    // New days got ids: adopt them so the next save updates them in place.
    const idByKey = new Map(snapshot.map((d, i) => [d.key, result.dayIds[i]]));
    const savedDays = snapshot.map((d) => ({ ...d, id: idByKey.get(d.key) }));
    setDays((prev) => prev.map((d) => (idByKey.has(d.key) ? { ...d, id: idByKey.get(d.key) } : d)));
    // Show what was stored (trimmed) unless the user kept typing meanwhile.
    setName((n) => (n === payload.name ? result.name : n));
    setDescription((d) => (d === payload.description ? result.description : d));
    setBaseline(JSON.stringify(toState(result.name, result.description, savedDays)));
    setErrors(NO_ERRORS);
    setSavedOnce(true);
    // Another tab's unsaved edits may sit in the slot; leave those.
    clearDraftIf(programId, (d) => isOwnDraft(d) || JSON.stringify(d.program) === JSON.stringify(payload));
    pendingDraft.current = null;
    setDraftOffer(null);
    return true;
  }

  function handleSave() {
    commitFocusedField();
    startSaving(async () => {
      await save();
    });
  }

  function saveAndLeave() {
    const href = leaveTo;
    commitFocusedField();
    startSaving(async () => {
      const ok = await save();
      if (ok && href) {
        leaving.current = true;
        router.push(href);
      } else {
        setLeaveTo(null);
      }
    });
  }

  function discardAndLeave() {
    const href = leaveTo;
    leaving.current = true;
    clearDraftIf(programId, isOwnDraft);
    setLeaveTo(null);
    if (href) router.push(href);
  }

  // ---------------------------------------------------------------- render

  const dayHasErrors = (day: EditableDay) =>
    !!errors.days[day.key] || day.exercises.some((e) => errors.rows[e.rowId]);
  const draftIsStale = draftOffer ? draftOffer.base !== version : false;
  const summary = saveBarSummary(errors);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={`/app/programs/${programId}`}
        className="-ml-1 mb-3 inline-flex min-h-11 items-center gap-1.5 px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Programa
      </Link>

      {draftOffer ? (
        <div role="status" className="mb-4 border-l-2 border-l-warning bg-warning-soft px-3.5 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-warning">
            Rascunho neste aparelho · {draftTime.format(draftOffer.savedAt)}
          </p>
          <p className="mt-1 text-sm text-foreground/90">
            {draftIsStale
              ? "Há alterações não salvas de antes da última vez que este programa foi salvo."
              : "Há alterações não salvas da sua última edição."}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Button size="sm" className="px-3" onClick={restoreDraft}>
              Restaurar alterações não salvas
            </Button>
            <Button size="sm" variant="ghost" className="px-2.5" onClick={dismissDraft}>
              Descartar
            </Button>
          </div>
        </div>
      ) : null}

      <Input
        id="program-name"
        value={name}
        maxLength={PROGRAM_NAME_MAX}
        aria-label="Nome do programa"
        aria-invalid={errors.name ? true : undefined}
        aria-describedby={errors.name ? "program-name-error" : undefined}
        onChange={(e) => {
          setName(e.target.value);
          setSavedOnce(false);
          if (errors.name && e.target.value.trim()) setErrors((er) => ({ ...er, name: null }));
        }}
        onBlur={() => {
          if (!name.trim()) setErrors((er) => ({ ...er, name: NAME_REQUIRED }));
        }}
        placeholder="Nome do programa"
        className={cn(
          "rounded-none border-0 border-b-2 border-b-transparent px-0 text-2xl font-bold tracking-tight shadow-none focus-visible:border-b-accent focus-visible:outline-none",
          errors.name && "border-b-danger",
        )}
      />
      {errors.name ? (
        <p id="program-name-error" role="alert" className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
          {errors.name}
        </p>
      ) : null}
      <Textarea
        id="program-description"
        value={description}
        maxLength={PROGRAM_DESCRIPTION_MAX}
        aria-label="Descrição"
        onChange={(e) => {
          setDescription(e.target.value);
          setSavedOnce(false);
          if (errors.description) setErrors((er) => ({ ...er, description: null }));
        }}
        placeholder="Descrição (opcional)"
        rows={2}
        className="mt-1 border-none px-0 text-base text-muted shadow-none focus-visible:outline-none sm:text-sm"
      />
      {errors.description ? (
        <p role="alert" className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
          {errors.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {days.map((day, i) => (
          <button
            key={day.key}
            type="button"
            onClick={() => setActiveDayIndex(i)}
            aria-pressed={i === activeDayIndex}
            className={cn(
              "flex min-h-10 items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-sm",
              i === activeDayIndex
                ? "border-accent bg-accent-soft font-semibold text-accent"
                : "border-border text-muted hover:bg-surface-2",
            )}
          >
            {day.name || `Dia ${i + 1}`}
            {dayHasErrors(day) ? (
              <span className="font-mono text-xs font-bold text-danger" aria-label="com erro">
                !
              </span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          onClick={addDay}
          disabled={days.length >= MAX_PROGRAM_DAYS}
          className="flex min-h-10 items-center gap-1 rounded-[2px] border border-dashed border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-2 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Dia
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1 rounded-[var(--radius-md)] bg-surface-2 py-2 pl-3.5 pr-2">
        <Input
          id="day-name"
          value={activeDay.name}
          maxLength={DAY_NAME_MAX}
          aria-label="Nome do dia"
          onChange={(e) => renameDay(e.target.value)}
          className="h-10 flex-1 bg-transparent text-base sm:h-8 sm:text-sm"
        />
        <button
          type="button"
          onClick={() => moveDay(activeDayIndex, -1)}
          disabled={activeDayIndex === 0}
          className="flex size-10 items-center justify-center rounded-[3px] text-muted hover:bg-surface disabled:opacity-30 sm:size-8"
          aria-label="Mover dia para cima"
        >
          <ArrowUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => moveDay(activeDayIndex, 1)}
          disabled={activeDayIndex === days.length - 1}
          className="flex size-10 items-center justify-center rounded-[3px] text-muted hover:bg-surface disabled:opacity-30 sm:size-8"
          aria-label="Mover dia para baixo"
        >
          <ArrowDown className="size-4" />
        </button>
        {days.length > 1 ? (
          <button
            type="button"
            onClick={() => removeDay(activeDayIndex)}
            className="flex size-10 items-center justify-center rounded-[3px] text-muted hover:bg-surface hover:text-danger sm:size-8"
            aria-label="Remover dia"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      {errors.days[activeDay.key] ? (
        <p role="alert" className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
          {errors.days[activeDay.key]}
        </p>
      ) : null}

      <div className="mt-4">
        {activeDay.exercises.length === 0 ? (
          <p className="border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 p-6 text-center text-sm text-muted">
            Nenhum exercício neste dia ainda.
          </p>
        ) : (
          <DndContext id="program-builder" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeDay.exercises.map((e) => e.rowId)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2.5">
                {activeDay.exercises.map((ex, i) => (
                  <ExerciseRow
                    key={ex.rowId}
                    id={ex.rowId}
                    index={i}
                    count={activeDay.exercises.length}
                    exercise={ex}
                    errors={errors.rows[ex.rowId]}
                    onChange={(patch) => updateExercise(ex.rowId, patch)}
                    onEdit={() => setSavedOnce(false)}
                    onMove={(delta) => moveExercise(ex.rowId, delta)}
                    onRemove={() => removeExercise(ex.rowId)}
                    onDuplicate={() => duplicateExercise(ex.rowId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={activeDay.exercises.length >= MAX_DAY_EXERCISES}
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-4" />
          Adicionar exercício
        </Button>
      </div>

      <div className="sticky bottom-[var(--nav-h)] z-20 mt-8 border-t border-border bg-background py-3 sm:bottom-0">
        {summary ? (
          <p role="alert" className="mb-2.5 border-l-2 border-l-danger bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {summary}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-warning">
            {dirty && !saving ? "Alterações não salvas" : ""}
          </p>
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "Salvando…" : !dirty && savedOnce ? "Salvo" : "Salvar programa"}
          </Button>
        </div>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} />

      {leaveTo ? (
        <LeaveSheet
          saving={saving}
          onSaveAndLeave={saveAndLeave}
          onDiscard={discardAndLeave}
          onStay={() => setLeaveTo(null)}
        />
      ) : null}
    </div>
  );
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
