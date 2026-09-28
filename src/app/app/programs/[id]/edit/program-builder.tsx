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
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarRange,
  Copy,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { SwitchProgramButton } from "@/components/programs/switch-program-button";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";
import {
  saveProgram,
  type BuilderDay,
  type BuilderExercise,
  type SaveProgramResult,
} from "@/lib/actions/program-builder";
import {
  BUILDER_LIMITS,
  DAY_FOCUS_MAX,
  DAY_NAME_MAX,
  MAX_DAY_EXERCISES,
  MAX_PROGRAM_DAYS,
  PROGRAM_DESCRIPTION_MAX,
  PROGRAM_LIMITS,
  PROGRAM_NAME_MAX,
  defaultPrescription,
  frequencyRange,
  validateBuilderProgram,
  type BuilderFieldError,
} from "@/lib/validation/program-builder";
import { parseDecimalInput } from "@/lib/training/set-plan";
import { dayTokens } from "@/lib/programming/day-tokens";
import { analyzeProgram, type ProgramRuleDay } from "@/lib/programming/rules";
import { weeklyVolume } from "@/lib/programming/weekly-volume";
import type { PickerExercise } from "@/lib/programming/exercise-facets";
import { ExercisePicker } from "./exercise-picker";
import { ExerciseRow, ROW_FIELD_LABELS, type RowErrors, type RowField } from "./exercise-row";
import { LeaveSheet } from "./leave-sheet";
import { ActionSheet, SheetItem } from "./action-sheet";
import { VolumeStrip } from "./volume-strip";
import { AutoGrowText } from "./auto-grow";

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
  /** "Treinos por semana" and "Duração (semanas, opcional)" (absent in drafts saved before they existed). */
  daysPerWeek?: number;
  durationWeeks?: number | null;
}
/** The program's own numbers, edited in the header. */
interface Cadence {
  daysPerWeek: number;
  durationWeeks: number | null;
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
function toState(name: string, description: string, days: EditableDay[], cadence: Cadence): ProgramState {
  return {
    name,
    description,
    daysPerWeek: cadence.daysPerWeek,
    durationWeeks: cadence.durationWeeks,
    days: days.map((d) => ({
      id: d.id,
      name: d.name,
      focus: d.focus,
      exercises: d.exercises.map((e) => ({
        id: e.id,
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
        rpeTarget: e.rpeTarget,
        tempo: e.tempo,
        progressionStrategy: e.progressionStrategy,
        loadIncrementKg: e.loadIncrementKg,
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
      (p.daysPerWeek === undefined || typeof p.daysPerWeek === "number") &&
      (p.durationWeeks === undefined || p.durationWeeks === null || typeof p.durationWeeks === "number") &&
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
  | { kind: "cadence"; field: CadenceField }
  | { kind: "day"; key: string }
  | { kind: "row"; rowId: string; field: RowField }
  /** Form-level problem: only the next save clears it. */
  | { kind: "form" };

type CadenceField = "daysPerWeek" | "durationWeeks";

interface BuilderErrors {
  rows: Record<string, RowErrors>;
  days: Record<string, string>;
  name: string | null;
  description: string | null;
  cadence: Partial<Record<CadenceField, string>>;
  /** The last save's problems in order; the save bar names the first still open. */
  items: { ref: ErrorRef; text: string }[];
  /** A save-bar message not tied to a field (offline, expired session). */
  message: string | null;
}
const NO_ERRORS: BuilderErrors = { rows: {}, days: {}, name: null, description: null, cadence: {}, items: [], message: null };

function isOpen(e: BuilderErrors, ref: ErrorRef) {
  switch (ref.kind) {
    case "name":
      return !!e.name;
    case "description":
      return !!e.description;
    case "cadence":
      return !!e.cadence[ref.field];
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

/** The sheet open over the builder: one row's actions, one day's, or a confirm. */
type Sheet =
  | { kind: "row"; rowId: string }
  | { kind: "move"; rowId: string }
  | { kind: "day" }
  | { kind: "remove-day" }
  | { kind: "discard" };

/** The last removal/move, undoable for a few seconds from the save bar. */
interface Undo {
  id: number;
  text: string;
  restore: () => void;
}
const UNDO_MS = 6000;

// Drag and drop, told in Portuguese (dnd-kit's defaults are English).
const DRAG_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Para mover um exercício, pressione espaço ou Enter, use as setas para cima e para baixo e pressione espaço ou Enter de novo para soltar. Esc cancela.",
};

/** A new Undo id: a fresh toast restarts its timer even with the same text. */
let undoSeq = 0;

export function ProgramBuilder({
  programId,
  programName,
  programDescription,
  programDaysPerWeek,
  programDurationWeeks,
  initialDays,
  version,
  status,
  sourceTemplate,
  canDiscard,
  exercises,
  machineNotes,
  equipmentAccess,
  openSession,
  switchFrom,
  start,
  startFromPage = false,
  discard,
  notice,
}: {
  programId: string;
  programName: string;
  programDescription: string;
  /** UserProgram.daysPerWeek / durationWeeks: the header's "Treinos por semana" and "Duração". */
  programDaysPerWeek: number;
  programDurationWeeks: number | null;
  initialDays: BuilderDay[];
  /** The program's updatedAt (ISO), to tell whether a local draft predates a save. */
  version: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  /** The template it was copied from ("Cópia de GD 1 · o original não muda"). */
  sourceTemplate: { name: string; slug: string } | null;
  /** A draft never trained: "Descartar rascunho" deletes it. */
  canDiscard: boolean;
  /** Thumbnails, equipment and muscles of the exercises already in the program. */
  exercises: PickerExercise[];
  /** The user's machine notes, by exercise id. */
  machineNotes: Record<string, string>;
  /** Profile.equipmentAccess: the picker's default equipment chip. */
  equipmentAccess: string | null;
  /** This program's workout still open, which an edit never changes. */
  openSession: { id: string; name: string } | null;
  /** Another program running now: starting this one is a switch that ends it. */
  switchFrom: { name: string; progress: string } | null;
  /** startProgram, bound to this program. */
  start: (formData: FormData) => void | Promise<void>;
  /** Trained before (stopped or finished): after a save, send to its page, which offers resuming. */
  startFromPage?: boolean;
  /** discardDraft, bound to this program. */
  discard: (formData: FormData) => void | Promise<void>;
  /** How the builder was reached: a "Duplicar" copy or an "Adaptar" fork. */
  notice: { kind: "copy" } | { kind: "adapted"; swaps: number } | null;
}) {
  const router = useRouter();
  const [initial] = useState(() => {
    let n = 0;
    const days = toEditable(initialDays, (prefix) => `${prefix}-${n++}`);
    const range = frequencyRange(days.length);
    const cadence: Cadence = {
      daysPerWeek: Math.min(range.max, Math.max(range.min, programDaysPerWeek)),
      durationWeeks: programDurationWeeks,
    };
    return { days, cadence, key: JSON.stringify(toState(programName, programDescription, days, cadence)) };
  });
  const [name, setName] = useState(programName);
  const [description, setDescription] = useState(programDescription);
  const [cadence, setCadence] = useState<Cadence>(initial.cadence);
  const [days, setDays] = useState<EditableDay[]>(initial.days);
  const [baseline, setBaseline] = useState(initial.key);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMuscle, setPickerMuscle] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // "Salvo": saved in this visit — or a draft opened clean with exercises (an "Adaptar"
  // copy lands already saved), which can start right away instead of asking for a save
  // that changes nothing. Any edit, or unsaved edits from an earlier visit, clear it.
  const [savedOnce, setSavedOnce] = useState(
    () => status === "DRAFT" && !startFromPage && initial.days.some((d) => d.exercises.length > 0),
  );
  const [errors, setErrors] = useState<BuilderErrors>(NO_ERRORS);
  const [draftOffer, setDraftOffer] = useState<StoredDraft | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, PickerExercise>>(() =>
    Object.fromEntries(exercises.map((e) => [e.id, e])),
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(notice !== null);
  // A save moves an archived program back to the shelf as a draft.
  const [currentStatus, setCurrentStatus] = useState(status);

  const current = useMemo(() => toState(name, description, days, cadence), [name, description, days, cadence]);
  const currentKey = useMemo(() => JSON.stringify(current), [current]);
  const dirty = currentKey !== baseline;
  /** The editor state as of the last commit: a save reads this, not its render's closure. */
  const latest = useRef({ name, description, days, cadence });
  useLayoutEffect(() => {
    latest.current = { name, description, days, cadence };
  });

  /** Set once the user chose to leave: no more guards or draft writes. */
  const leaving = useRef(false);
  /** Mount-time draft read done; a draft still waiting for restore/discard. */
  const draftChecked = useRef(false);
  const pendingDraft = useRef<StoredDraft | null>(null);
  /** CSS selector to focus after the next render (error field, moved row, the control a sheet came from). */
  const pendingFocus = useRef<string | null>(null);
  const focusTries = useRef(0);
  /** Row to bring on screen after the next render (the first one just added). */
  const pendingScroll = useRef<string | null>(null);
  /** Exercise ids whose details were already asked for. */
  const metaRequested = useRef(new Set<string>());
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
  const exerciseName = (rowId: string) => {
    for (const d of days) {
      const ex = d.exercises.find((e) => e.rowId === rowId);
      if (ex) return ex.exerciseName ?? meta[ex.exerciseId]?.namePt ?? "exercício";
    }
    return "exercício";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${exerciseName(String(active.id))} selecionado.`,
    onDragOver: ({ active, over }) =>
      over ? `${exerciseName(String(active.id))} sobre a posição de ${exerciseName(String(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${exerciseName(String(active.id))} solto na posição de ${exerciseName(String(over.id))}.` : `${exerciseName(String(active.id))} solto.`,
    onDragCancel: ({ active }) => `Movimento cancelado. ${exerciseName(String(active.id))} voltou ao lugar.`,
  };

  // One-time look for unsaved edits from an earlier visit.
  useEffect(() => {
    const stored = readDraft(programId);
    if (stored && JSON.stringify(stored.program) !== initial.key) {
      pendingDraft.current = stored;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external store on mount
      setDraftOffer(stored);
      setSavedOnce(false);
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
    if (selector) {
      const el = document.querySelector<HTMLElement>(selector);
      // The target may appear a render later (a row opening to show an error,
      // the save transition committing after its pending render): wait a few.
      if (el || ++focusTries.current > 4) {
        pendingFocus.current = null;
        focusTries.current = 0;
      }
      if (el) {
        if (el.matches("input, textarea")) el.scrollIntoView({ block: "center" });
        el.focus({ preventScroll: !el.matches("input, textarea") });
      }
    }
    const row = pendingScroll.current;
    if (row) {
      pendingScroll.current = null;
      document.querySelector(`[data-row-id="${row}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  // The day tab in view when the day changes (the row scrolls sideways).
  useEffect(() => {
    document.getElementById(`day-tab-${activeDay?.key}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeDay?.key]);

  // "?copia=1" / "?adaptado=N" say it once: a reload doesn't bring the notice back.
  useEffect(() => {
    if (!notice || !window.location.search) return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
  }, [notice]);

  // An undo offer lasts a few seconds.
  useEffect(() => {
    if (!undo) return;
    const handle = setTimeout(() => setUndo((u) => (u?.id === undo.id ? null : u)), UNDO_MS);
    return () => clearTimeout(handle);
  }, [undo]);

  // Details (thumbnail, muscles) for exercises the page didn't load: a draft
  // restored from another visit carries only their ids.
  useEffect(() => {
    const missing = [
      ...new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)).filter((id) => !meta[id] && !metaRequested.current.has(id))),
    ];
    if (!missing.length) return;
    for (const id of missing) metaRequested.current.add(id);
    const controller = new AbortController();
    fetch(`/api/exercises/search?ids=${missing.map(encodeURIComponent).join(",")}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ items: PickerExercise[] }>) : { items: [] }))
      .then(({ items }) => {
        if (items.length) setMeta((m) => ({ ...m, ...Object.fromEntries(items.map((e) => [e.id, e])) }));
      })
      .catch(() => {
        for (const id of missing) metaRequested.current.delete(id);
      });
  }, [days, meta]);

  // ---------------------------------------------------------------- edits

  function patchDays(fn: (prev: EditableDay[]) => EditableDay[]) {
    setDays(fn);
    setSavedOnce(false);
  }

  function patchDay(key: string, fn: (list: EditableExercise[]) => EditableExercise[]) {
    patchDays((prev) => prev.map((d) => (d.key === key ? { ...d, exercises: fn(d.exercises) } : d)));
  }

  function patchActiveExercises(fn: (list: EditableExercise[]) => EditableExercise[]) {
    patchDay(activeDay.key, fn);
  }

  function offerUndo(text: string, restore: () => void) {
    setUndo({ id: ++undoSeq, text, restore });
  }

  function selectDay(index: number, focusTab = false) {
    setActiveDayIndex(index);
    if (focusTab && days[index]) pendingFocus.current = `#day-tab-${days[index].key}`;
  }

  function renameDay(value: string) {
    const key = activeDay.key;
    patchDays((prev) => prev.map((d) => (d.key === key ? { ...d, name: value } : d)));
    if (errors.days[key]) setErrors((e) => ({ ...e, days: omit(e.days, key) }));
  }

  function changeFocus(value: string) {
    const key = activeDay.key;
    patchDays((prev) => prev.map((d) => (d.key === key ? { ...d, focus: value === "" ? null : value } : d)));
    if (errors.days[key]) setErrors((e) => ({ ...e, days: omit(e.days, key) }));
  }

  /** At least one workout a week per day of the program. */
  function ensureFrequency(dayCount: number) {
    setCadence((c) => (c.daysPerWeek < dayCount ? { ...c, daysPerWeek: dayCount } : c));
    if (errors.cadence.daysPerWeek) setErrors((e) => ({ ...e, cadence: omitKey(e.cadence, "daysPerWeek") }));
  }

  function addDay() {
    if (days.length >= MAX_PROGRAM_DAYS) return;
    const key = newId("day");
    patchDays((prev) => [...prev, { key, name: `Dia ${prev.length + 1}`, focus: null, exercises: [] }]);
    setActiveDayIndex(days.length);
    ensureFrequency(days.length + 1);
    pendingFocus.current = "#day-name";
  }

  /** "Duplicar dia": an A/B/A or upper/lower ×2 without re-adding every exercise. */
  function duplicateDay() {
    if (days.length >= MAX_PROGRAM_DAYS) return;
    const source = activeDay;
    const key = newId("day");
    // A named day copies right after itself as "… (cópia)". A generic "Dia 1"
    // copies as the next free "Dia N" at the end, so the number matches its tab
    // (inserted after Dia 1 it read Dia 1, Dia 4, Dia 2, Dia 3).
    let name = `${source.name} (cópia)`.slice(0, DAY_NAME_MAX);
    let at = activeDayIndex + 1;
    if (/^dia \d+$/i.test(source.name.trim()) || !source.name.trim()) {
      const taken = new Set(days.map((d) => d.name.trim().toLowerCase()));
      let n = days.length + 1;
      while (taken.has(`dia ${n}`)) n++;
      name = `Dia ${n}`;
      at = days.length;
    }
    const copy: EditableDay = {
      key,
      name,
      focus: source.focus,
      exercises: source.exercises.map((e) => ({ ...e, id: undefined, rowId: newId("row") })),
    };
    patchDays((prev) => [...prev.slice(0, at), copy, ...prev.slice(at)]);
    setActiveDayIndex(at);
    ensureFrequency(days.length + 1);
    pendingFocus.current = "#day-name";
  }

  function changeCadence(patch: Partial<Cadence>) {
    setCadence((c) => ({ ...c, ...patch }));
    setSavedOnce(false);
    const fixed = (Object.keys(patch) as CadenceField[]).filter((f) => errors.cadence[f]);
    if (fixed.length) {
      setErrors((e) => {
        let next = e.cadence;
        for (const f of fixed) next = omitKey(next, f);
        return { ...e, cadence: next };
      });
    }
  }

  function removeDay(index: number) {
    const removed = days[index];
    if (!removed || days.length <= 1) return;
    patchDays((prev) => prev.filter((d) => d.key !== removed.key));
    setActiveDayIndex((i) => Math.max(0, Math.min(days.length - 2, i)));
    // A program longer than a week keeps one workout per day; back within a week, at most 7.
    const { max } = frequencyRange(days.length - 1);
    setCadence((c) => (c.daysPerWeek > max ? { ...c, daysPerWeek: max } : c));
    // Its errors go with it (and so do their save-bar lines).
    if (dayHasErrors(removed)) {
      setErrors((e) => {
        const rows = { ...e.rows };
        for (const ex of removed.exercises) delete rows[ex.rowId];
        return { ...e, rows, days: omit(e.days, removed.key) };
      });
    }
    offerUndo(`Dia “${removed.name || `Dia ${index + 1}`}” removido`, () => {
      patchDays((prev) => (prev.some((d) => d.key === removed.key) ? prev : insertAt(prev, index, removed)));
      setActiveDayIndex(index);
      ensureFrequency(days.length);
    });
    pendingFocus.current = "[data-day-actions]";
  }

  function moveDay(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= days.length) return;
    patchDays((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveDayIndex(target);
  }

  function addExercises(picked: PickerExercise[]) {
    const room = MAX_DAY_EXERCISES - activeDay.exercises.length;
    const list = picked.slice(0, Math.max(0, room));
    if (!list.length) return;
    const rows: EditableExercise[] = list.map((p) => ({
      rowId: newId("row"),
      exerciseId: p.id,
      exerciseName: p.namePt,
      groupKey: null,
      ...defaultPrescription(p.mechanics),
      loadTargetKg: null,
      notes: null,
    }));
    patchActiveExercises((ex) => [...ex, ...rows]);
    setMeta((m) => ({ ...m, ...Object.fromEntries(list.map((p) => [p.id, p])) }));
    pendingScroll.current = rows[0].rowId;
    pendingFocus.current = `[data-row-id="${rows[0].rowId}"] [data-row-toggle]`;
  }

  function updateExercise(rowId: string, patch: Partial<BuilderExercise>) {
    const before = activeDay.exercises.find((e) => e.rowId === rowId);
    patchActiveExercises((list) => list.map((e) => (e.rowId === rowId ? { ...e, ...patch } : e)));
    const rowErrors = errors.rows[rowId];
    if (!rowErrors || !before) return;
    const after = { ...before, ...patch };
    // Editing a field clears its error (blur settles the value). The range
    // error sits on the min, so it also clears once the max puts it right.
    const fixed = (Object.keys(rowErrors) as RowField[]).filter(
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
    const dayKey = activeDay.key;
    const index = activeDay.exercises.findIndex((e) => e.rowId === rowId);
    const removed = activeDay.exercises[index];
    if (!removed) return;
    patchDay(dayKey, (list) => list.filter((e) => e.rowId !== rowId));
    if (errors.rows[rowId]) setErrors((e) => ({ ...e, rows: omit(e.rows, rowId) }));
    offerUndo(`${removed.exerciseName ?? "Exercício"} removido`, () =>
      patchDay(dayKey, (list) => (list.some((e) => e.rowId === rowId) ? list : insertAt(list, index, removed))),
    );
    // Focus the next row's "⋯" (or the add button) instead of losing it to the page.
    const next = activeDay.exercises[index + 1] ?? activeDay.exercises[index - 1];
    pendingFocus.current = next ? `[data-row-id="${next.rowId}"] [data-row-actions]` : "[data-add-exercises]";
  }

  function duplicateExercise(rowId: string) {
    if (activeDay.exercises.length >= MAX_DAY_EXERCISES) return;
    const copyId = newId("row");
    patchActiveExercises((list) => {
      const idx = list.findIndex((e) => e.rowId === rowId);
      if (idx === -1) return list;
      const next = [...list];
      // A new row (no id) that keeps everything else, including the
      // prescription the builder carries without showing.
      next.splice(idx + 1, 0, { ...list[idx], id: undefined, rowId: copyId });
      return next;
    });
    pendingFocus.current = `[data-row-id="${copyId}"] [data-row-actions]`;
  }

  function moveExercise(rowId: string, delta: -1 | 1) {
    patchActiveExercises((list) => {
      const from = list.findIndex((e) => e.rowId === rowId);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= list.length) return list;
      return arrayMove(list, from, to);
    });
    pendingFocus.current = `[data-row-id="${rowId}"] [data-row-actions]`;
  }

  /** "Mover para…": the row keeps its id, so its logged workouts stay linked. */
  function moveExerciseToDay(rowId: string, targetKey: string) {
    const fromKey = activeDay.key;
    const index = activeDay.exercises.findIndex((e) => e.rowId === rowId);
    const row = activeDay.exercises[index];
    const target = days.find((d) => d.key === targetKey);
    if (!row || !target || target.key === fromKey || target.exercises.length >= MAX_DAY_EXERCISES) return;
    patchDays((prev) =>
      prev.map((d) =>
        d.key === fromKey
          ? { ...d, exercises: d.exercises.filter((e) => e.rowId !== rowId) }
          : d.key === targetKey
            ? { ...d, exercises: [...d.exercises, row] }
            : d,
      ),
    );
    offerUndo(`${row.exerciseName ?? "Exercício"} movido para “${target.name}”`, () =>
      patchDays((prev) => {
        const there = prev.find((d) => d.key === targetKey)?.exercises.find((e) => e.rowId === rowId);
        if (!there || !prev.some((d) => d.key === fromKey)) return prev;
        return prev.map((d) =>
          d.key === targetKey
            ? { ...d, exercises: d.exercises.filter((e) => e.rowId !== rowId) }
            : d.key === fromKey
              ? { ...d, exercises: insertAt(d.exercises, index, there) }
              : d,
        );
      }),
    );
    const next = activeDay.exercises[index + 1] ?? activeDay.exercises[index - 1];
    pendingFocus.current = next ? `[data-row-id="${next.rowId}"] [data-row-actions]` : "[data-add-exercises]";
  }

  function toggleRow(rowId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
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

  function openPicker(muscle: string | null = null) {
    setPickerMuscle(muscle);
    setPickerOpen(true);
  }

  function closeSheet(focus?: string) {
    setSheet(null);
    if (focus) pendingFocus.current = focus;
  }

  // ---------------------------------------------------------------- draft

  function restoreDraft() {
    const draft = pendingDraft.current ?? draftOffer;
    if (!draft) return;
    const p = draft.program;
    setName(p.name);
    setDescription(p.description);
    setCadence((c) => ({
      daysPerWeek: p.daysPerWeek ?? Math.max(c.daysPerWeek, p.days.length),
      durationWeeks: p.durationWeeks === undefined ? c.durationWeeks : p.durationWeeks,
    }));
    setDays(toEditable(p.days, newId));
    setActiveDayIndex(0);
    setExpanded(new Set());
    setErrors(NO_ERRORS);
    setSavedOnce(false);
    setUndo(null);
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
    const next: BuilderErrors = { ...NO_ERRORS, rows: {}, days: {}, cadence: {}, items: [] };
    let focus: { selector: string; dayKey?: string } | null = null;
    const open = new Set<string>();
    for (const err of list) {
      if (err.field === "name" || err.field === "description") {
        next[err.field] = err.message;
        next.items.push({ ref: { kind: err.field }, text: err.message });
        focus ??= { selector: `#program-${err.field}` };
        continue;
      }
      if (err.field === "daysPerWeek" || err.field === "durationWeeks") {
        next.cadence = { ...next.cadence, [err.field]: err.message };
        const label = err.field === "daysPerWeek" ? "Treinos por semana" : "Duração";
        next.items.push({ ref: { kind: "cadence", field: err.field }, text: `${label}: ${err.message}` });
        focus ??= { selector: `#program-${err.field}` };
        continue;
      }
      const day = err.dayIndex !== null ? snapshot[err.dayIndex] : undefined;
      const row = day && err.exerciseIndex !== null ? day.exercises[err.exerciseIndex] : undefined;
      if (day && row && (err.field in BUILDER_LIMITS || err.field === "notes")) {
        const field = err.field as RowField;
        next.rows[row.rowId] = { ...next.rows[row.rowId], [field]: err.message };
        next.items.push({
          ref: { kind: "row", rowId: row.rowId, field },
          text: `${ROW_FIELD_LABELS[field]} em ${row.exerciseName ?? "exercício"}: ${err.message}`,
        });
        // The row opens so the field is there to fix.
        open.add(row.rowId);
        focus ??= {
          selector: `[data-row-id="${row.rowId}"] ${field === "notes" ? "textarea" : "input"}[data-field="${field}"]`,
          dayKey: day.key,
        };
        continue;
      }
      if (day) {
        next.days[day.key] = err.message;
        focus ??= { selector: err.field === "dayFocus" ? "#day-focus" : "#day-name", dayKey: day.key };
      }
      next.items.push({
        ref: day ? { kind: "day", key: day.key } : { kind: "form" },
        text: day ? `${day.name}: ${err.message}` : err.message,
      });
    }
    if (!next.items.length) next.message = "Não foi possível salvar.";
    setErrors(next);
    if (open.size) setExpanded((prev) => new Set([...prev, ...open]));
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
    if (el instanceof HTMLInputElement && (el.dataset.field || el.dataset.cadence)) flushSync(() => el.blur());
  }

  async function save(): Promise<boolean> {
    const { name, description, days: snapshot, cadence: savedCadence } = latest.current;
    const payload = toState(name, description, snapshot, savedCadence);
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

    // New days and rows got ids: adopt them so the next save updates them in
    // place (a row saved without its id would be deleted and recreated).
    const idByKey = new Map(snapshot.map((d, i) => [d.key, result.dayIds[i]]));
    const idByRow = new Map(
      snapshot.flatMap((d, i) => d.exercises.map((e, j) => [e.rowId, result.exerciseIds[i]?.[j]] as const)),
    );
    const adoptIds = (d: EditableDay): EditableDay => ({
      ...d,
      id: idByKey.get(d.key) ?? d.id,
      exercises: d.exercises.map((e) => (idByRow.get(e.rowId) ? { ...e, id: idByRow.get(e.rowId) } : e)),
    });
    const savedDays = snapshot.map(adoptIds);
    setDays((prev) => prev.map(adoptIds));
    // Show what was stored (trimmed) unless the user kept typing meanwhile.
    setName((n) => (n === payload.name ? result.name : n));
    setDescription((d) => (d === payload.description ? result.description : d));
    const stored: Cadence = { daysPerWeek: result.daysPerWeek, durationWeeks: result.durationWeeks };
    setCadence((c) =>
      c.daysPerWeek === payload.daysPerWeek && c.durationWeeks === payload.durationWeeks ? stored : c,
    );
    setBaseline(JSON.stringify(toState(result.name, result.description, savedDays, stored)));
    setErrors(NO_ERRORS);
    setSavedOnce(true);
    setCurrentStatus((s) => (s === "ARCHIVED" ? "DRAFT" : s));
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

  // ---------------------------------------------------------------- derived

  const dayHasErrors = (day: EditableDay) =>
    !!errors.days[day.key] || day.exercises.some((e) => errors.rows[e.rowId]);
  const draftIsStale = draftOffer ? draftOffer.base !== version : false;
  const summary = saveBarSummary(errors);
  const tokens = dayTokens(days.map((d, i) => d.name || `Dia ${i + 1}`));
  const hasExercises = days.some((d) => d.exercises.length > 0);
  const room = MAX_DAY_EXERCISES - activeDay.exercises.length;
  // Nothing unsaved and nothing touched since the last save (or a clean open, see savedOnce).
  const settled = !dirty && savedOnce;

  const volume = useMemo(
    () =>
      weeklyVolume(
        days.map((d) => ({
          exercises: d.exercises.map((e) => ({
            sets: e.sets,
            primaryMuscleIds: meta[e.exerciseId]?.primaryMuscleIds ?? null,
            secondaryMuscleIds: meta[e.exerciseId]?.secondaryMuscleIds ?? null,
          })),
        })),
        cadence.daysPerWeek,
      ),
    [days, meta, cadence.daysPerWeek],
  );
  // The program rules the strip doesn't already say (volume is the strip itself).
  const ruleNotes = useMemo(() => {
    const ruleDays: ProgramRuleDay[] = days.map((d, i) => ({
      dayIndex: i,
      nameEn: d.name,
      namePt: d.name || `Dia ${i + 1}`,
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        nameEn: e.exerciseName ?? "",
        namePt: e.exerciseName ?? meta[e.exerciseId]?.namePt ?? "",
        primaryMuscleGroups: (meta[e.exerciseId]?.primaryGroups ?? []) as ProgramRuleDay["exercises"][number]["primaryMuscleGroups"],
        movementPattern: meta[e.exerciseId]?.movementPattern ?? null,
        sets: e.sets,
      })),
    }));
    return analyzeProgram(ruleDays)
      .filter((f) => !/^(low|high)-volume-/.test(f.code))
      .map((f) => f.messagePt);
  }, [days, meta]);

  const sheetRow =
    sheet && (sheet.kind === "row" || sheet.kind === "move")
      ? activeDay.exercises.find((e) => e.rowId === sheet.rowId) ?? null
      : null;
  const sheetRowIndex = sheetRow ? activeDay.exercises.indexOf(sheetRow) : -1;
  const activeDayLabel = activeDay.name || `Dia ${activeDayIndex + 1}`;

  // ---------------------------------------------------------------- render

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6 pt-3 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/programs/${programId}`}
          className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Programa
        </Link>
        {canDiscard ? (
          <button
            type="button"
            onClick={() => setSheet({ kind: "discard" })}
            className="-mr-2 min-h-11 px-2 text-xs font-medium text-muted hover:text-danger"
          >
            Descartar rascunho
          </button>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h1 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Editar programa</h1>
        <span
          className={cn(
            "font-mono text-[10px] font-bold uppercase tracking-[0.14em]",
            currentStatus === "ACTIVE" ? "text-accent" : "text-muted",
          )}
        >
          · {currentStatus === "ACTIVE" ? "Ativo" : currentStatus === "DRAFT" ? "Rascunho" : "Arquivado"}
        </span>
      </div>
      {sourceTemplate ? (
        <p className="mt-0.5 text-xs text-muted">
          Sua cópia de{" "}
          <Link href={`/app/programs/templates/${sourceTemplate.slug}`} className="font-semibold text-accent hover:underline">
            {sourceTemplate.name}
          </Link>{" "}
          — o original não muda.
        </p>
      ) : null}

      {currentStatus === "ACTIVE" ? (
        <div className="mt-3 border-l-2 border-l-accent bg-surface-2 px-3 py-2" data-testid="active-program-note">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Programa ativo</p>
          <p className="mt-0.5 text-sm text-foreground/90">
            As mudanças valem a partir do próximo treino.
            {openSession ? (
              <>
                {" "}
                O treino aberto (<span className="font-semibold">{openSession.name}</span>) continua como começou.
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {notice && noticeOpen ? (
        <div role="status" className="mt-3 flex items-start gap-3 border-l-2 border-l-success bg-surface-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-success">
              {notice.kind === "copy" ? "Cópia criada" : "Adaptado ao seu equipamento"}
            </p>
            <p className="mt-0.5 text-sm text-foreground/90">
              {notice.kind === "copy"
                ? "Você está editando a cópia. O original continua como estava."
                : notice.swaps > 0
                  ? `${plural(notice.swaps, "exercício trocado", "exercícios trocados")}. Ajuste o que quiser e comece quando estiver pronto.`
                  : "Nenhum exercício precisou de troca."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNoticeOpen(false)}
            className="-my-1 -mr-2 min-h-11 px-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground"
          >
            OK
          </button>
        </div>
      ) : null}

      {draftOffer ? (
        <div role="status" className="mt-3 border-l-2 border-l-warning bg-warning-soft px-3.5 py-3">
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
          "mt-2 rounded-none border-0 border-b-2 border-b-transparent px-0 text-2xl font-bold tracking-tight shadow-none focus-visible:border-b-accent focus-visible:outline-none",
          errors.name && "border-b-danger",
        )}
      />
      {errors.name ? (
        <p id="program-name-error" role="alert" className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
          {errors.name}
        </p>
      ) : null}
      {/* Grows with the text: a GD block's long tagline is read whole, not cut at two lines. */}
      <AutoGrowText
        id="program-description"
        value={description}
        maxLength={PROGRAM_DESCRIPTION_MAX}
        maxHeight={220}
        aria-label="Descrição"
        onValueChange={(value) => {
          setDescription(value);
          setSavedOnce(false);
          if (errors.description) setErrors((er) => ({ ...er, description: null }));
        }}
        placeholder="Descrição (opcional)"
        className="mt-1 min-h-11 rounded-[3px] border border-transparent bg-transparent px-0 py-2 text-base leading-snug text-muted placeholder:text-muted/80 hover:border-foreground/20 focus-visible:outline-none sm:text-sm"
      />
      {errors.description ? (
        <p role="alert" className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
          {errors.description}
        </p>
      ) : null}

      <CadenceChips cadence={cadence} dayCount={days.length} errors={errors.cadence} onChange={changeCadence} />

      <VolumeStrip
        volume={volume}
        notes={ruleNotes}
        dayFull={room <= 0 ? activeDay.name || `Dia ${activeDayIndex + 1}` : null}
        onAddFor={(key) => {
          if (room > 0) openPicker(key);
        }}
      />

      {/* Day tabs: one row that scrolls sideways ("D1 SEG · SUP"), full names in the box below. */}
      <div className="-mx-4 mt-4 flex items-center gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        <div
          role="tablist"
          aria-label="Dias do programa"
          className="flex items-center gap-1"
          onKeyDown={(e) => {
            const last = days.length - 1;
            // From the tab that has focus (normally the selected one: roving tabindex).
            const focused = days.findIndex((d) => `day-tab-${d.key}` === (e.target as HTMLElement).id);
            const from = focused >= 0 ? focused : activeDayIndex;
            const to =
              e.key === "ArrowRight"
                ? Math.min(last, from + 1)
                : e.key === "ArrowLeft"
                  ? Math.max(0, from - 1)
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? last
                      : null;
            if (to === null) return;
            e.preventDefault();
            selectDay(to, true);
          }}
        >
          {days.map((day, i) => {
            const token = tokens[i];
            const label = day.name || `Dia ${i + 1}`;
            const selected = i === activeDayIndex;
            return (
              <button
                key={day.key}
                id={`day-tab-${day.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="day-panel"
                aria-label={`${label}${dayHasErrors(day) ? " (com erro)" : ""}`}
                tabIndex={selected ? 0 : -1}
                title={label}
                onClick={() => selectDay(i)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em]",
                  selected
                    ? "border-b-accent bg-surface-2 text-foreground"
                    : "border-b-transparent text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <span className={selected ? "text-accent" : undefined}>D{i + 1}</span>
                {token && token !== String(i + 1) ? <span>{token}</span> : null}
                {dayHasErrors(day) ? <span className="text-danger">!</span> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addDay}
          disabled={days.length >= MAX_PROGRAM_DAYS}
          aria-label="Adicionar dia"
          className="flex h-11 shrink-0 items-center gap-1 border border-dashed border-border-strong px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Dia
        </button>
      </div>

      <div id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${activeDay.key}`}>
        <div className="bg-surface-2 px-3 py-2.5">
          <div className="flex items-center gap-1">
            <label htmlFor="day-name" className="sr-only">
              Nome do dia
            </label>
            <AutoGrowText
              id="day-name"
              singleLine
              value={activeDay.name}
              maxLength={DAY_NAME_MAX}
              aria-invalid={errors.days[activeDay.key] ? true : undefined}
              onValueChange={renameDay}
              className="min-h-11 flex-1 rounded-[3px] border border-transparent bg-transparent px-1.5 py-2 text-base font-semibold leading-snug hover:border-foreground/30 sm:text-sm"
            />
            <button
              type="button"
              data-day-actions
              onClick={() => setSheet({ kind: "day" })}
              aria-haspopup="dialog"
              aria-label={`Opções do dia ${activeDayLabel}`}
              className="flex size-11 shrink-0 items-center justify-center text-muted hover:bg-surface hover:text-foreground"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
          <label htmlFor="day-focus" className="sr-only">
            Foco do dia
          </label>
          <AutoGrowText
            id="day-focus"
            singleLine
            value={activeDay.focus ?? ""}
            maxLength={DAY_FOCUS_MAX}
            onValueChange={changeFocus}
            placeholder="Foco do dia (opcional)"
            className="min-h-11 rounded-[3px] border border-transparent bg-transparent px-1.5 py-2.5 text-base leading-snug text-muted placeholder:text-muted/80 hover:border-foreground/30 sm:text-sm"
          />
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
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                  {plural(activeDay.exercises.length, "exercício", "exercícios")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 px-3"
                  data-add-exercises
                  disabled={room <= 0}
                  onClick={() => openPicker()}
                >
                  <Plus className="size-4" />
                  Adicionar exercícios
                </Button>
              </div>
              <DndContext
                id="program-builder"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                accessibility={{ screenReaderInstructions: DRAG_INSTRUCTIONS, announcements }}
              >
                <SortableContext items={activeDay.exercises.map((e) => e.rowId)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {activeDay.exercises.map((ex) => (
                      <ExerciseRow
                        key={ex.rowId}
                        id={ex.rowId}
                        exercise={ex}
                        meta={meta[ex.exerciseId]}
                        machineNote={machineNotes[ex.exerciseId] ?? null}
                        expanded={expanded.has(ex.rowId)}
                        onToggle={() => toggleRow(ex.rowId)}
                        errors={errors.rows[ex.rowId]}
                        onChange={(patch) => updateExercise(ex.rowId, patch)}
                        onEdit={() => setSavedOnce(false)}
                        onOpenActions={() => setSheet({ kind: "row", rowId: ex.rowId })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}

          <Button
            variant="outline"
            className="mt-3 w-full"
            data-add-exercises={activeDay.exercises.length === 0 ? true : undefined}
            disabled={room <= 0}
            onClick={() => openPicker()}
          >
            <Plus className="size-4" />
            {activeDay.exercises.length === 0 ? "Adicionar exercícios" : "Adicionar mais exercícios"}
          </Button>
        </div>
      </div>

      <div className="sticky bottom-[var(--nav-h)] z-20 -mx-4 mt-6 border-t-2 border-t-[var(--rule-heavy)] bg-background px-4 py-2 sm:bottom-0 sm:-mx-6 sm:px-6">
        {undo ? (
          <div role="status" className="mb-2 flex items-center gap-3 border-l-2 border-l-accent bg-surface-2 py-0.5 pl-3 pr-1">
            <span className="min-w-0 flex-1 text-sm leading-snug">{undo.text}</span>
            <button
              type="button"
              onClick={() => {
                undo.restore();
                setUndo(null);
              }}
              className="min-h-11 shrink-0 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Desfazer
            </button>
          </div>
        ) : null}
        {summary ? (
          <p role="alert" className="mb-2 border-l-2 border-l-danger bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {summary}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {settled && hasExercises && !saving ? (
            currentStatus === "ACTIVE" ? (
              <Button asChild variant="strong">
                <Link href="/app/today">Ir para Hoje</Link>
              </Button>
            ) : startFromPage ? (
              <Button asChild variant="strong">
                <Link href={`/app/programs/${programId}`}>Retomar ou recomeçar</Link>
              </Button>
            ) : (
              <SwitchProgramButton
                action={start}
                label="Iniciar este programa"
                switchLabel="Iniciar este programa"
                pendingLabel="Iniciando…"
                size="md"
                active={switchFrom}
              />
            )
          ) : (
            <p aria-live="polite" className="mr-auto font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-warning">
              {dirty && !saving ? "Alterações não salvas" : ""}
            </p>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            variant={settled ? "ghost" : "primary"}
            className={cn(settled && "text-success")}
          >
            {saving ? "Salvando…" : settled ? "Salvo" : "Salvar programa"}
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addExercises}
        inDayIds={activeDay.exercises.map((e) => e.exerciseId)}
        maxSelect={room}
        initialMuscle={pickerMuscle}
        equipmentAccess={equipmentAccess}
        title={`Adicionar ao dia ${activeDayIndex + 1}`}
      />

      {sheet?.kind === "row" && sheetRow ? (
        <ActionSheet
          title={sheetRow.exerciseName ?? "Exercício"}
          subtitle={activeDayLabel}
          onClose={() => closeSheet(`[data-row-id="${sheetRow.rowId}"] [data-row-actions]`)}
        >
          <SheetItem
            icon={<ArrowUp />}
            disabled={sheetRowIndex <= 0}
            onClick={() => {
              closeSheet();
              moveExercise(sheetRow.rowId, -1);
            }}
          >
            Mover para cima
          </SheetItem>
          <SheetItem
            icon={<ArrowDown />}
            disabled={sheetRowIndex >= activeDay.exercises.length - 1}
            onClick={() => {
              closeSheet();
              moveExercise(sheetRow.rowId, 1);
            }}
          >
            Mover para baixo
          </SheetItem>
          {days.length > 1 ? (
            <SheetItem icon={<CalendarRange />} onClick={() => setSheet({ kind: "move", rowId: sheetRow.rowId })}>
              Mover para outro dia…
            </SheetItem>
          ) : null}
          <SheetItem
            icon={<Copy />}
            disabled={activeDay.exercises.length >= MAX_DAY_EXERCISES}
            onClick={() => {
              closeSheet();
              duplicateExercise(sheetRow.rowId);
            }}
          >
            Duplicar
          </SheetItem>
          <SheetItem
            icon={<Trash2 />}
            danger
            onClick={() => {
              closeSheet();
              removeExercise(sheetRow.rowId);
            }}
          >
            Remover
          </SheetItem>
        </ActionSheet>
      ) : null}

      {sheet?.kind === "move" && sheetRow ? (
        <ActionSheet
          title="Mover para qual dia?"
          subtitle={sheetRow.exerciseName}
          onClose={() => closeSheet(`[data-row-id="${sheetRow.rowId}"] [data-row-actions]`)}
        >
          {days.map((d, i) =>
            d.key === activeDay.key ? null : (
              <SheetItem
                key={d.key}
                disabled={d.exercises.length >= MAX_DAY_EXERCISES}
                onClick={() => {
                  closeSheet();
                  moveExerciseToDay(sheetRow.rowId, d.key);
                }}
              >
                <span className="font-mono text-xs font-bold text-muted">D{i + 1}</span> {d.name || `Dia ${i + 1}`}
              </SheetItem>
            ),
          )}
          <SheetItem icon={<ArrowLeft />} onClick={() => setSheet({ kind: "row", rowId: sheetRow.rowId })}>
            Voltar
          </SheetItem>
        </ActionSheet>
      ) : null}

      {sheet?.kind === "day" ? (
        <ActionSheet
          title={activeDayLabel}
          subtitle={`Dia ${activeDayIndex + 1} de ${days.length}`}
          onClose={() => closeSheet("[data-day-actions]")}
        >
          <SheetItem
            icon={<ArrowLeft />}
            disabled={activeDayIndex === 0}
            onClick={() => {
              closeSheet("[data-day-actions]");
              moveDay(activeDayIndex, -1);
            }}
          >
            Mover dia para antes
          </SheetItem>
          <SheetItem
            icon={<ArrowRight />}
            disabled={activeDayIndex === days.length - 1}
            onClick={() => {
              closeSheet("[data-day-actions]");
              moveDay(activeDayIndex, 1);
            }}
          >
            Mover dia para depois
          </SheetItem>
          <SheetItem
            icon={<Copy />}
            disabled={days.length >= MAX_PROGRAM_DAYS}
            onClick={() => {
              closeSheet();
              duplicateDay();
            }}
          >
            Duplicar dia
          </SheetItem>
          {days.length > 1 ? (
            <SheetItem
              icon={<Trash2 />}
              danger
              onClick={() => {
                if (activeDay.exercises.length > 0) return setSheet({ kind: "remove-day" });
                closeSheet();
                removeDay(activeDayIndex);
              }}
            >
              Remover dia
            </SheetItem>
          ) : null}
        </ActionSheet>
      ) : null}

      {sheet?.kind === "remove-day" ? (
        <ActionSheet
          title={`Remover “${activeDayLabel}”?`}
          subtitle={`${plural(activeDay.exercises.length, "exercício sai", "exercícios saem")} deste dia. Dá para desfazer logo em seguida.`}
          onClose={() => closeSheet("[data-day-actions]")}
        >
          <SheetItem
            icon={<Trash2 />}
            danger
            onClick={() => {
              closeSheet();
              removeDay(activeDayIndex);
            }}
          >
            Remover dia
          </SheetItem>
          <SheetItem onClick={() => closeSheet("[data-day-actions]")}>Cancelar</SheetItem>
        </ActionSheet>
      ) : null}

      {sheet?.kind === "discard" ? (
        <ActionSheet
          title="Descartar este rascunho?"
          subtitle={
            sourceTemplate
              ? `Sua cópia é apagada de vez. ${sourceTemplate.name} continua na biblioteca.`
              : "O programa é apagado de vez. Ele nunca foi treinado, então nenhum histórico se perde."
          }
          onClose={() => closeSheet()}
        >
          <InlineActionForm
            action={discard}
            failText="Não foi possível descartar. Tente de novo."
            className="flex flex-col gap-2 px-5 py-3"
          >
            <SubmitButton
              variant="danger"
              className="w-full"
              pendingLabel="Descartando…"
              onClick={() => {
                // Leaving on purpose: no guard, no local copy left behind.
                leaving.current = true;
                clearDraft(programId);
              }}
            >
              Descartar rascunho
            </SubmitButton>
            <Button variant="ghost" className="w-full" onClick={() => closeSheet()}>
              Continuar editando
            </Button>
          </InlineActionForm>
        </ActionSheet>
      ) : null}

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

function omitKey<K extends string, T>(record: Partial<Record<K, T>>, key: K): Partial<Record<K, T>> {
  const next = { ...record };
  delete next[key];
  return next;
}

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const at = Math.max(0, Math.min(list.length, index));
  return [...list.slice(0, at), item, ...list.slice(at)];
}

const CHIP_LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted";
const STEP_BUTTON =
  "flex h-11 w-10 shrink-0 items-center justify-center rounded-[2px] border border-border font-mono text-base font-bold text-foreground/80 hover:bg-surface-2 disabled:opacity-30";

/**
 * The header's stat chips: "Treinos por semana" (at least one per day; more
 * repeats days — a full body 3×, A/B 3×) and "Duração (semanas, opcional)".
 * The number boxes commit on blur like the exercise rows; ± steps the frequency.
 */
function CadenceChips({
  cadence,
  dayCount,
  errors,
  onChange,
}: {
  cadence: Cadence;
  dayCount: number;
  errors: Partial<Record<CadenceField, string>>;
  onChange: (patch: Partial<Cadence>) => void;
}) {
  const range = frequencyRange(dayCount);
  const repeats = cadence.daysPerWeek > dayCount;
  const hint =
    dayCount === 1
      ? cadence.daysPerWeek === 1
        ? "O mesmo treino, uma vez por semana."
        : `O mesmo treino, ${cadence.daysPerWeek}× por semana.`
      : repeats
        ? `${dayCount} dias em ${cadence.daysPerWeek} treinos: os dias se alternam (${alternation(dayCount, cadence.daysPerWeek)}).`
        : "Cada dia uma vez por semana.";
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 divide-x divide-border border-y border-border">
        <div className="flex min-w-0 flex-col gap-1.5 py-2.5 pr-3">
          <label htmlFor="program-daysPerWeek" className={CHIP_LABEL}>
            Treinos por semana
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={STEP_BUTTON}
              aria-label="Menos um treino por semana"
              disabled={cadence.daysPerWeek <= range.min}
              onClick={() => onChange({ daysPerWeek: Math.max(range.min, cadence.daysPerWeek - 1) })}
            >
              −
            </button>
            <NumberBox
              id="program-daysPerWeek"
              value={cadence.daysPerWeek}
              invalid={!!errors.daysPerWeek}
              onCommit={(n) =>
                onChange({ daysPerWeek: n === null ? cadence.daysPerWeek : Math.min(range.max, Math.max(range.min, n)) })
              }
            />
            <button
              type="button"
              className={STEP_BUTTON}
              aria-label="Mais um treino por semana"
              disabled={cadence.daysPerWeek >= range.max}
              onClick={() => onChange({ daysPerWeek: Math.min(range.max, cadence.daysPerWeek + 1) })}
            >
              +
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 py-2.5 pl-3">
          <label htmlFor="program-durationWeeks" className={CHIP_LABEL}>
            Duração (semanas, opcional)
          </label>
          <NumberBox
            id="program-durationWeeks"
            value={cadence.durationWeeks}
            invalid={!!errors.durationWeeks}
            placeholder="—"
            suffix={cadence.durationWeeks ? "sem." : undefined}
            onCommit={(n) =>
              onChange({
                durationWeeks:
                  n === null
                    ? null
                    : Math.min(PROGRAM_LIMITS.durationWeeks.max, Math.max(PROGRAM_LIMITS.durationWeeks.min, n)),
              })
            }
          />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
      {errors.daysPerWeek || errors.durationWeeks ? (
        <p role="alert" className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
          {errors.daysPerWeek ?? errors.durationWeeks}
        </p>
      ) : null}
    </div>
  );
}

/** "A, B, A…" for 2 days at 3×; "A, B, C, A…" for 3 at 4×. */
function alternation(dayCount: number, perWeek: number) {
  const letters = Array.from({ length: Math.min(dayCount, 6) }, (_, i) => String.fromCharCode(65 + i));
  return `${[...letters, letters[0]].slice(0, Math.min(perWeek, letters.length + 1)).join(", ")}…`;
}

/** A whole-number box that commits on blur or Enter (empty = null). */
function NumberBox({
  id,
  value,
  invalid,
  placeholder,
  suffix,
  onCommit,
}: {
  id: string;
  value: number | null;
  invalid: boolean;
  placeholder?: string;
  suffix?: string;
  onCommit: (n: number | null) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : String(value));
  const commit = () => {
    if (text === null) return;
    const n = parseDecimalInput(text);
    setText(null);
    onCommit(n === null ? null : Math.round(n));
  };
  return (
    <div className="flex min-w-0 items-baseline gap-1">
      <Input
        id={id}
        data-cadence
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(
          "h-11 w-12 px-1.5 text-center font-mono text-lg font-bold tabular-nums",
          invalid && "border-danger",
        )}
      />
      {suffix ? <span className="font-mono text-xs font-bold text-muted">{suffix}</span> : null}
    </div>
  );
}
