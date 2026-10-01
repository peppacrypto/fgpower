"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Link2Off, MoreHorizontal } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
import { AutoGrowText } from "./auto-grow";
import { cn } from "@/lib/utils/cn";
import { formatDecimal, parseDecimalInput } from "@/lib/training/set-plan";
import type { BuilderExercise } from "@/lib/actions/program-builder";
import type { PickerExercise } from "@/lib/programming/exercise-facets";
import { TRANSITION_PRESETS, groupRule, type GroupSlot } from "@/lib/programming/groups";
import {
  BUILDER_FIELD_LABELS,
  BUILDER_LIMITS,
  EXERCISE_NOTE_MAX,
  REST_PRESETS,
  commitBuilderNumber,
  formatRestClock,
  isStorableBuilderNumber,
  prescriptionLine,
  reconcileRepRange,
  type BuilderNumberField,
  type NumberCommit,
} from "@/lib/validation/program-builder";

/** A row's problems found on save, by field (the number boxes and the note). */
export type RowField = BuilderNumberField | "notes";
export type RowErrors = Partial<Record<RowField, string>>;

export const ROW_FIELD_LABELS: Record<RowField, string> = { ...BUILDER_FIELD_LABELS, notes: "Nota" };

interface RowProps {
  id: string;
  exercise: BuilderExercise;
  /** Thumbnail, equipment and muscles (absent until loaded for a restored draft). */
  meta?: PickerExercise;
  /** The user's own machine note for this exercise ("Banco na posição 4"), written mid-workout. */
  machineNote?: string | null;
  expanded: boolean;
  onToggle: () => void;
  /** Problems found on save, by field. */
  errors?: RowErrors;
  onChange: (patch: Partial<BuilderExercise>) => void;
  /** Any keystroke in a number box, storable or not (so "Salvo" goes away). */
  onEdit: () => void;
  /** The row's "⋯": move, duplicate, group, remove. */
  onOpenActions: () => void;
  /** Its place in a superset / circuit (W-104), null outside one. */
  group?: GroupSlot | null;
  /** "Desagrupar" on the group's first member: the whole group comes apart. */
  onUngroup?: () => void;
  /** Stretching / cardio: shown but not counted in the week's volume (L-volume-counts-stretches). */
  noVolume?: boolean;
}

const FIELDS: RowField[] = ["sets", "repMin", "repMax", "rirTarget", "warmupSets", "restSeconds", "notes"];

/** A value the app changed on blur, flagged until the user edits the row again. */
type Notice = { field: BuilderNumberField; text: string };

function noticeFor(field: BuilderNumberField, commit: NumberCommit): Notice | null {
  const label = BUILDER_FIELD_LABELS[field];
  const { min, max } = BUILDER_LIMITS[field];
  if (commit.adjusted === "min") return { field, text: `${label}: mínimo ${min}` };
  if (commit.adjusted === "max") return { field, text: `${label}: máximo ${max}` };
  if (commit.adjusted === "step") return { field, text: `${label}: arredondado para ${formatDecimal(commit.value)}` };
  return null;
}

const FIELD_LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted";

/** The member after this one ("A2"), for a switch's "Troca para A2". */
function nextLabel(group: GroupSlot): string {
  return `${group.key}${group.position + 1}`;
}

/**
 * One exercise of the builder, folded to a line — thumbnail, the whole name
 * (never cut where variants differ) and "3 × 8–12 · RIR 2 · 2:00" — so a day
 * of six fits on a phone screen. Tapping the line opens the numbers: steppers
 * for séries / RIR / aquecimento, the rep range, rest as clock chips
 * (1:00…4:00, "Outro" for seconds) and the note shown mid-workout. The grip
 * drags; "⋯" holds the rest (mover, duplicar, remover).
 */
export function ExerciseRow({
  id,
  exercise,
  meta,
  machineNote,
  expanded,
  onToggle,
  errors,
  onChange,
  onEdit,
  onOpenActions,
  group = null,
  onUngroup,
  noVolume = false,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rirHelp, setRirHelp] = useState(false);
  const name = exercise.exerciseName ?? meta?.namePt ?? "Exercício";
  // A member's rest is where it goes: the switch to the next one, or the rest after the round.
  const restText = group
    ? group.last
      ? `${formatRestClock(exercise.restSeconds)} após a rodada`
      : `${formatRestClock(exercise.restSeconds)} até ${nextLabel(group)}`
    : undefined;
  const parts = prescriptionLine(exercise, { restText }).split(" · ");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commit(field: BuilderNumberField, result: NumberCommit) {
    let patch: Partial<BuilderExercise> = { [field]: result.value };
    let next = noticeFor(field, result);
    if ((field === "repMin" || field === "repMax") && result.value !== null) {
      const range = reconcileRepRange(
        field === "repMin" ? result.value : exercise.repMin,
        field === "repMax" ? result.value : exercise.repMax,
        field,
      );
      if (range.adjusted) {
        patch = { repMin: range.repMin, repMax: range.repMax };
        next = { field: range.adjusted, text: `Faixa ajustada: ${range.repMin}–${range.repMax} · mín ≤ máx` };
      }
    }
    if (Object.entries(patch).some(([k, v]) => exercise[k as keyof BuilderExercise] !== v)) onChange(patch);
    setNotice(next);
  }

  /** −/+ on a whole-number box (RIR steps by 1 too; typing "1,5" still works). */
  function step(field: BuilderNumberField, delta: -1 | 1) {
    const { min, max } = BUILDER_LIMITS[field];
    const current = exercise[field];
    const base = current ?? (delta > 0 ? min - 1 : min);
    // To the next whole number in the direction pressed: from RIR 2,5, + is 3 and − is 2.
    const next = Math.min(max, Math.max(min, delta > 0 ? Math.floor(base) + 1 : Math.ceil(base) - 1));
    setNotice(null);
    onEdit();
    if (next !== current) onChange({ [field]: next });
  }

  const hintId = `${id}-hint`;
  const editorId = `${id}-editor`;
  const firstError = errors ? FIELDS.find((f) => errors[f]) : undefined;
  // The prescription's last part, then the row's tags and its error mark: each stays whole.
  const tail = [
    parts[parts.length - 1],
    exercise.notes ? <span className="tag tag--spec align-[1px]">Nota</span> : null,
    noVolume ? <span className="tag tag--spec align-[1px]">Não conta no volume</span> : null,
    errors && firstError ? (
      <span className="font-bold text-danger" aria-label="com erro">
        !
      </span>
    ) : null,
  ].filter((item) => item !== null);
  const hint = firstError
    ? { tone: "error" as const, text: `${ROW_FIELD_LABELS[firstError]}: ${errors?.[firstError]}` }
    : notice
      ? { tone: "notice" as const, text: notice.text }
      : null;
  const tone = (field: BuilderNumberField): "error" | "adjusted" | null =>
    errors?.[field] ? "error" : notice?.field === field ? "adjusted" : null;
  const numberProps = (field: BuilderNumberField, ariaLabel: string) => ({
    field,
    ariaLabel,
    value: exercise[field],
    tone: tone(field),
    describedBy: hint ? hintId : undefined,
    onEdit: () => {
      setNotice(null);
      onEdit();
    },
    onValue: (v: number | null) => onChange({ [field]: v }),
    onCommit: (result: NumberCommit) => commit(field, result),
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-row-id={id}
      data-expanded={expanded || undefined}
      data-group={group?.label}
      className={cn(
        "reg-frame",
        // A group's members sit together on one accent rule (W-104), joined by a hairline.
        group && "border-l-2 border-l-accent",
        group && !group.first && "-mt-2 border-t border-t-border",
        isDragging && "z-10 opacity-60",
      )}
    >
      {group?.first ? (
        <div className="flex items-center justify-between gap-2 border-b border-border pl-3">
          <p className="min-w-0 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent" data-group-rule>
            {groupRule(group)}
          </p>
          {onUngroup ? (
            <button
              type="button"
              onClick={onUngroup}
              aria-label={`Desagrupar ${group.heading}`}
              className="flex min-h-11 shrink-0 items-center gap-1 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted hover:text-foreground"
            >
              <Link2Off className="size-3.5" />
              Desagrupar
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-stretch">
        {/* The grip drags (touch-none so a press on it never scrolls the page instead). */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center text-muted hover:text-foreground active:cursor-grabbing"
          aria-label={`Arrastar ${name} para reordenar`}
        >
          <GripVertical className="size-5" />
        </button>
        <button
          type="button"
          data-row-toggle
          aria-expanded={expanded}
          aria-controls={editorId}
          onClick={onToggle}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 text-left"
        >
          <span className="relative size-9 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
            {meta?.imageUrl ? (
              <Image src={meta.imageUrl} alt="" fill sizes="36px" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-muted">
                <GLoad className="size-4" />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug wrap-break-word">
              {group ? (
                <span className="mr-1.5 font-mono text-[11px] font-bold text-accent" data-group-label>
                  <span aria-hidden>{group.label}</span>
                  <span className="sr-only">
                    {group.heading}, {group.position} de {group.size}:
                  </span>
                </span>
              ) : null}
              <span data-row-name>{name}</span>
            </span>
            <span className="mt-0.5 block font-mono text-[11px] leading-relaxed tabular-nums text-muted">
              {/* Wraps between the parts ("3 × 6–10 · RIR 2 · 2:30") and before a tag, never inside one;
                  the chevron rides the last. (All on one unbreakable run, "Nota" and "Não conta no
                  volume" ran out of a 320px row.) */}
              {parts
                .slice(0, -1)
                .map((part) => `${part.replace(/ /g, "\u00a0")} · `)
                .join("")}
              {tail.map((item, i) =>
                i < tail.length - 1 ? (
                  <Fragment key={i}>
                    <span className="whitespace-nowrap">{item}</span>{" "}
                  </Fragment>
                ) : (
                  <span key={i} className="whitespace-nowrap">
                    {item}
                    <ChevronDown
                      className={cn("ml-1.5 inline-block size-3.5 align-[-2px] transition-transform", expanded && "rotate-180")}
                      aria-hidden
                    />
                  </span>
                ),
              )}
            </span>
          </span>
        </button>
        <button
          type="button"
          data-row-actions
          onClick={onOpenActions}
          aria-haspopup="dialog"
          aria-label={`Opções de ${name}`}
          className="flex w-11 shrink-0 items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {expanded ? (
        <div id={editorId} className="border-t border-border px-3 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
            <FieldBox label="Séries">
              <Stepper label="séries" onStep={(d) => step("sets", d)} value={exercise.sets} field="sets">
                <NumberField {...numberProps("sets", "Séries")} />
              </Stepper>
            </FieldBox>
            <FieldBox label="Repetições">
              <div className="flex items-center gap-1">
                <NumberField {...numberProps("repMin", "Rep. mín")} wide />
                <span className="font-mono text-muted" aria-hidden>
                  –
                </span>
                <NumberField {...numberProps("repMax", "Rep. máx")} wide />
              </div>
            </FieldBox>
            <FieldBox
              label="RIR"
              help={<RirHelpButton open={rirHelp} controls={`${id}-rir-help`} onToggle={() => setRirHelp((o) => !o)} />}
            >
              <Stepper label="RIR" onStep={(d) => step("rirTarget", d)} value={exercise.rirTarget} field="rirTarget">
                <NumberField {...numberProps("rirTarget", "RIR")} />
              </Stepper>
            </FieldBox>
            <FieldBox label="Aquecimento">
              <Stepper
                label="séries de aquecimento"
                onStep={(d) => step("warmupSets", d)}
                value={exercise.warmupSets}
                field="warmupSets"
              >
                <NumberField {...numberProps("warmupSets", "Séries de aquecimento")} />
              </Stepper>
            </FieldBox>
          </div>
          {rirHelp ? (
            <p id={`${id}-rir-help`} className="mt-2 border-l-2 border-l-accent bg-surface-2 px-2.5 py-1.5 text-xs leading-snug text-foreground/85">
              <span className="font-semibold">RIR</span> = repetições na reserva: quantas você ainda faria ao parar a série.
              RIR 2 = pare com ~2 sobrando. Vazio = sem alvo.
            </p>
          ) : null}

          <RestField
            value={exercise.restSeconds}
            group={group}
            forceCustom={!!errors?.restSeconds || notice?.field === "restSeconds"}
            onPick={(s) => {
              setNotice(null);
              onEdit();
              if (s !== exercise.restSeconds) onChange({ restSeconds: s });
            }}
          >
            <NumberField {...numberProps("restSeconds", "Descanso em segundos")} wide />
          </RestField>

          <NoteField
            rowId={id}
            value={exercise.notes}
            invalid={!!errors?.notes}
            describedBy={hint ? hintId : undefined}
            machineNote={machineNote ?? null}
            onChange={(notes) => {
              onEdit();
              onChange({ notes });
            }}
          />

          {hint ? (
            <p
              id={hintId}
              role={hint.tone === "error" ? "alert" : "status"}
              className="mt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger"
            >
              {hint.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FieldBox({ label, help, children }: { label: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn(FIELD_LABEL, "flex min-h-4 items-center gap-1")}>
        {label}
        {help}
      </span>
      {children}
    </div>
  );
}

const STEP_BUTTON =
  "flex h-11 w-10 shrink-0 items-center justify-center border border-foreground/30 font-mono text-lg font-bold text-foreground/80 hover:bg-surface-2 disabled:opacity-30";

function Stepper({
  label,
  field,
  value,
  onStep,
  children,
}: {
  label: string;
  field: BuilderNumberField;
  value: number | null;
  onStep: (delta: -1 | 1) => void;
  children: React.ReactNode;
}) {
  const { min, max } = BUILDER_LIMITS[field];
  return (
    <div className="flex items-center">
      <button
        type="button"
        className={cn(STEP_BUTTON, "border-r-0")}
        aria-label={`Diminuir ${label}`}
        disabled={value === null || value <= min}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      {children}
      <button
        type="button"
        className={cn(STEP_BUTTON, "border-l-0")}
        aria-label={`Aumentar ${label}`}
        disabled={value !== null && value >= max}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </div>
  );
}

/** "?" next to RIR: opens a line saying what the number means. */
function RirHelpButton({ open, controls, onToggle }: { open: boolean; controls: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label="O que é RIR?"
      onClick={onToggle}
      className="relative flex size-4 items-center justify-center rounded-full border border-current text-[9px] font-bold normal-case tracking-normal hover:text-foreground after:absolute after:-inset-3.5 after:content-['']"
    >
      ?
    </button>
  );
}

/**
 * Rest as clock chips; "Outro" opens the seconds box for anything else. In a
 * superset (W-104) a member's rest is the switch to the next one (short
 * chips: 0:00–0:45) and the last member's is the rest after the round.
 */
function RestField({
  value,
  group,
  forceCustom,
  onPick,
  children,
}: {
  value: number;
  group: GroupSlot | null;
  forceCustom: boolean;
  onPick: (seconds: number) => void;
  children: React.ReactNode;
}) {
  const switching = group !== null && !group.last;
  const presets: readonly number[] = switching ? TRANSITION_PRESETS : REST_PRESETS;
  const preset = presets.includes(value);
  const [customOpen, setCustomOpen] = useState(false);
  const custom = customOpen || forceCustom || !preset;
  return (
    <fieldset className="mt-3 min-w-0">
      <legend className={cn(FIELD_LABEL, "mb-1")}>
        {switching ? `Troca para ${nextLabel(group)}` : group ? "Descanso após a rodada" : "Descanso"}
      </legend>
      <div className="flex flex-wrap gap-1">
        {presets.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={!custom && value === s}
            onClick={() => {
              setCustomOpen(false);
              onPick(s);
            }}
            className={cn(
              "flex h-11 min-w-12 items-center justify-center px-2 font-mono text-sm font-semibold tabular-nums",
              !custom && value === s ? "bg-foreground text-background" : "bg-surface-2 text-foreground/80 hover:bg-[var(--border)]",
            )}
          >
            {formatRestClock(s)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustomOpen(true)}
          className={cn(
            "flex h-11 items-center justify-center px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em]",
            custom ? "bg-foreground text-background" : "bg-surface-2 text-foreground/80 hover:bg-[var(--border)]",
          )}
        >
          Outro
        </button>
      </div>
      {custom ? (
        <div className="mt-2 flex items-center gap-2">
          {children}
          <span className="font-mono text-xs text-muted">s · {formatRestClock(value)}</span>
        </div>
      ) : null}
    </fieldset>
  );
}

/** The cue shown under the exercise mid-workout (a GD block's comes with it); the machine note, read-only. */
function NoteField({
  rowId,
  value,
  invalid,
  describedBy,
  machineNote,
  onChange,
}: {
  rowId: string;
  value: string | null;
  invalid: boolean;
  describedBy?: string;
  machineNote: string | null;
  onChange: (notes: string | null) => void;
}) {
  // Open from the start when there is a note: emptying it to rewrite must not unmount the box mid-typing.
  const [open, setOpen] = useState(value !== null);
  const noteId = `${rowId}-note`;
  return (
    <div className="mt-3">
      {value !== null || open || invalid ? (
        <>
          <label htmlFor={noteId} className={FIELD_LABEL}>
            Nota · aparece no treino
          </label>
          <AutoGrowText
            id={noteId}
            data-field="notes"
            value={value ?? ""}
            maxLength={EXERCISE_NOTE_MAX}
            maxHeight={320}
            autoFocus={open && value === null}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            placeholder="Ex.: desça em 3 s; banco a 30°"
            onValueChange={(v) => onChange(v === "" ? null : v)}
            className={cn(
              "mt-1 min-h-16 rounded-[3px] border border-foreground/50 bg-surface px-3 py-2.5 text-base leading-snug text-foreground placeholder:text-muted sm:text-sm",
              invalid && "border-2 border-danger",
            )}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-ml-1 inline-flex min-h-11 items-center px-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent hover:underline"
        >
          + Nota para o treino
        </button>
      )}
      {machineNote ? (
        <p className="mt-2 border-l-2 border-l-border-strong pl-2.5 text-xs text-muted">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">Sua nota da máquina</span>{" "}
          {machineNote} <span className="text-muted/80">· edite durante o treino</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A number box that keeps what the user types (an empty box stays empty
 * while editing, "1,5" is fine) and only stores numbers it can save. Valid
 * values reach the program as they are typed; on blur the box settles on a
 * storable value — empty/garbage brings the previous one back, out-of-range
 * values are clamped — instead of the old `"" → 0` that crashed the save.
 */
function NumberField({
  field,
  ariaLabel,
  value,
  tone,
  describedBy,
  wide,
  onEdit,
  onValue,
  onCommit,
}: {
  field: BuilderNumberField;
  ariaLabel: string;
  value: number | null;
  /** "error": can't be saved as is; "adjusted": the app changed it on blur. */
  tone: "error" | "adjusted" | null;
  describedBy?: string;
  wide?: boolean;
  onEdit: () => void;
  onValue: (v: number | null) => void;
  onCommit: (result: NumberCommit) => void;
}) {
  const [text, setText] = useState(() => formatDecimal(value));
  const [editing, setEditing] = useState(false);
  // Follow outside changes (a stepper, the rep range fixed by the other box,
  // a restored draft) while the user is not typing here.
  const [shown, setShown] = useState(value);
  if (!editing && value !== shown) {
    setShown(value);
    setText(formatDecimal(value));
  }

  return (
    <input
      type="text"
      inputMode={BUILDER_LIMITS[field].step === 1 ? "numeric" : "decimal"}
      autoComplete="off"
      enterKeyHint="done"
      data-field={field}
      aria-label={ariaLabel}
      value={text}
      placeholder={field === "rirTarget" ? "–" : undefined}
      aria-invalid={tone === "error" || undefined}
      aria-describedby={describedBy}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onEdit();
        const n = parseDecimalInput(raw);
        if (n !== null && isStorableBuilderNumber(field, n)) onValue(n);
        else if (field === "rirTarget" && raw.trim() === "") onValue(null);
      }}
      onBlur={() => {
        const result = commitBuilderNumber(field, text, value);
        setEditing(false);
        setShown(result.value);
        setText(formatDecimal(result.value));
        onCommit(result);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn(
        "h-11 min-w-0 rounded-none border bg-surface px-1 text-center font-mono text-base tabular-nums placeholder:text-muted",
        wide ? "w-14 rounded-[3px]" : "w-11",
        tone === "error"
          ? "border-2 border-danger"
          : tone === "adjusted"
            ? "border-foreground/50 border-b-2 border-b-danger"
            : "border-foreground/50",
      )}
    />
  );
}
