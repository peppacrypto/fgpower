"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { BuilderExercise } from "@/lib/actions/program-builder";

interface RowProps {
  id: string;
  exercise: BuilderExercise;
  onChange: (patch: Partial<BuilderExercise>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

export function ExerciseRow({ id, exercise, onChange, onRemove, onDuplicate }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "reg-frame p-3.5",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="flex size-8 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="size-4" />
        </button>
        <p className="flex-1 truncate text-sm font-semibold">{exercise.exerciseName}</p>
        <button onClick={onDuplicate} aria-label="Duplicar" className="flex size-8 items-center justify-center rounded-[3px] text-muted hover:bg-surface-2">
          <Copy className="size-4" />
        </button>
        <button onClick={onRemove} aria-label="Remover" className="flex size-8 items-center justify-center rounded-[3px] text-muted hover:bg-surface-2 hover:text-danger">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Field label="Séries" value={exercise.sets} onChange={(v) => onChange({ sets: v === "" ? 0 : v })} min={1} max={10} />
        <Field label="Rep. mín" value={exercise.repMin} onChange={(v) => onChange({ repMin: v === "" ? 0 : v })} min={1} max={50} />
        <Field label="Rep. máx" value={exercise.repMax} onChange={(v) => onChange({ repMax: v === "" ? 0 : v })} min={1} max={50} />
        <Field
          label="RIR"
          value={exercise.rirTarget ?? ""}
          onChange={(v) => onChange({ rirTarget: v === "" ? null : v })}
          min={0}
          max={10}
          step={0.5}
        />
        <Field
          label="Descanso (s)"
          value={exercise.restSeconds}
          onChange={(v) => onChange({ restSeconds: v === "" ? 0 : v })}
          min={0}
          max={600}
          step={15}
        />
        <Field label="Aquec." value={exercise.warmupSets} onChange={(v) => onChange({ warmupSets: v === "" ? 0 : v })} min={0} max={5} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="h-9 w-full rounded-[3px] border border-border bg-surface px-1.5 text-center text-sm font-mono tabular-nums"
      />
    </label>
  );
}
