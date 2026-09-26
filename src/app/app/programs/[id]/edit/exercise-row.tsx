"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDecimal, parseDecimalInput } from "@/lib/training/set-plan";
import type { BuilderExercise } from "@/lib/actions/program-builder";
import {
  BUILDER_FIELD_LABELS,
  BUILDER_LIMITS,
  commitBuilderNumber,
  isStorableBuilderNumber,
  reconcileRepRange,
  type BuilderNumberField,
  type NumberCommit,
} from "@/lib/validation/program-builder";

export type RowErrors = Partial<Record<BuilderNumberField, string>>;

interface RowProps {
  id: string;
  index: number;
  count: number;
  exercise: BuilderExercise;
  /** Problems found on save, by field. */
  errors?: RowErrors;
  onChange: (patch: Partial<BuilderExercise>) => void;
  /** Any keystroke in a number box, storable or not (so "Salvo" goes away). */
  onEdit: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

const FIELDS: BuilderNumberField[] = ["sets", "repMin", "repMax", "rirTarget", "restSeconds", "warmupSets"];

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

export function ExerciseRow({ id, index, count, exercise, errors, onChange, onEdit, onMove, onRemove, onDuplicate }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [notice, setNotice] = useState<Notice | null>(null);

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

  const hintId = `${id}-hint`;
  const firstError = errors ? FIELDS.find((f) => errors[f]) : undefined;
  const hint = firstError
    ? { tone: "error" as const, text: `${BUILDER_FIELD_LABELS[firstError]}: ${errors?.[firstError]}` }
    : notice
      ? { tone: "notice" as const, text: notice.text }
      : null;

  const moveButton =
    "flex size-11 items-center justify-center rounded-[3px] text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-25";

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-row-id={id}
      className={cn("reg-frame flex gap-1 py-2.5 pl-1 pr-3", isDragging && "z-10 opacity-60")}
    >
      {/* Ordering spine: ↑/↓ always work; the grip drags (touch-none so a
          press on it never scrolls the page instead). */}
      <div className="flex w-11 shrink-0 flex-col items-center">
        <button
          type="button"
          data-move="up"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Mover ${exercise.exerciseName ?? "exercício"} para cima`}
          className={moveButton}
        >
          <ArrowUp className="size-4" />
        </button>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex size-11 cursor-grab touch-none select-none items-center justify-center rounded-[3px] text-muted hover:text-foreground active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="size-5" />
        </button>
        <button
          type="button"
          data-move="down"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          aria-label={`Mover ${exercise.exerciseName ?? "exercício"} para baixo`}
          className={moveButton}
        >
          <ArrowDown className="size-4" />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-0.5">
          <p className="line-clamp-2 flex-1 pt-2.5 text-sm font-semibold leading-snug">{exercise.exerciseName}</p>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicar"
            className="flex size-10 shrink-0 items-center justify-center rounded-[3px] text-muted hover:bg-surface-2"
          >
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover"
            className="flex size-10 shrink-0 items-center justify-center rounded-[3px] text-muted hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {FIELDS.map((field) => (
            <NumberField
              key={field}
              field={field}
              value={exercise[field]}
              tone={errors?.[field] ? "error" : notice?.field === field ? "adjusted" : null}
              describedBy={hint ? hintId : undefined}
              onEdit={() => {
                setNotice(null);
                onEdit();
              }}
              onValue={(v) => onChange({ [field]: v })}
              onCommit={(result) => commit(field, result)}
            />
          ))}
        </div>

        {hint ? (
          <p
            id={hintId}
            role={hint.tone === "error" ? "alert" : "status"}
            className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-danger"
          >
            {hint.text}
          </p>
        ) : null}
      </div>
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
  value,
  tone,
  describedBy,
  onEdit,
  onValue,
  onCommit,
}: {
  field: BuilderNumberField;
  value: number | null;
  /** "error": can't be saved as is; "adjusted": the app changed it on blur. */
  tone: "error" | "adjusted" | null;
  describedBy?: string;
  onEdit: () => void;
  onValue: (v: number | null) => void;
  onCommit: (result: NumberCommit) => void;
}) {
  const [text, setText] = useState(() => formatDecimal(value));
  const [editing, setEditing] = useState(false);
  // Follow outside changes (rep range fixed by the other box, draft restored)
  // while the user is not typing here.
  const [shown, setShown] = useState(value);
  if (!editing && value !== shown) {
    setShown(value);
    setText(formatDecimal(value));
  }

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium text-muted">{BUILDER_FIELD_LABELS[field]}</span>
      <input
        type="text"
        inputMode={BUILDER_LIMITS[field].step === 1 ? "numeric" : "decimal"}
        autoComplete="off"
        enterKeyHint="done"
        data-field={field}
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
        className={cn(
          "h-11 w-full min-w-0 rounded-[3px] border bg-surface px-1.5 text-center font-mono text-base tabular-nums placeholder:text-muted sm:h-9 sm:text-sm",
          tone === "error"
            ? "border-2 border-danger"
            : tone === "adjusted"
              ? "border-foreground/50 border-b-2 border-b-danger"
              : "border-foreground/50",
        )}
      />
    </label>
  );
}
