"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { logSet, removeSet } from "@/lib/actions/workouts";
import type { ExecutionSetLog } from "./types";

const SET_TYPE_LABEL: Record<ExecutionSetLog["setType"], string> = {
  WARMUP: "Aquec.",
  WORKING: "Série",
  DROP: "Drop",
  FAILURE: "Falha",
};

export function SetRow({
  set,
  isActive,
  prefillWeight,
  prefillReps,
  onCompleted,
}: {
  set: ExecutionSetLog;
  isActive: boolean;
  prefillWeight: number | null;
  prefillReps: number | null;
  onCompleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState<number | "">(set.weightKg ?? prefillWeight ?? "");
  const [reps, setReps] = useState<number | "">(set.reps ?? prefillReps ?? "");
  const [rir, setRir] = useState<number | "">(set.rir ?? "");
  const [pending, startTransition] = useTransition();

  const showEditor = isActive || editing;

  if (!showEditor) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-2.5">
        <span className="w-14 shrink-0 text-xs font-medium text-muted">{SET_TYPE_LABEL[set.setType]}</span>
        <span className="flex-1 font-mono text-sm tabular-nums">
          {set.weightKg ?? "—"} kg × {set.reps ?? "—"}
          {set.rir != null ? <span className="ml-2 text-muted">RIR {set.rir}</span> : null}
        </span>
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar série"
          className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-md)] border p-3.5",
        isActive ? "border-accent bg-accent-soft" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">
          {SET_TYPE_LABEL[set.setType]} {set.setNumber}
        </span>
        {!isActive ? (
          <button onClick={() => setEditing(false)} className="text-xs text-muted hover:text-foreground">
            Cancelar
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="kg" value={weight} onChange={setWeight} step={0.5} />
        <NumberField label="reps" value={reps} onChange={setReps} step={1} />
        <NumberField label="RIR" value={rir} onChange={setRir} step={0.5} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={pending || weight === "" || reps === ""}
          onClick={() => {
            startTransition(async () => {
              await logSet({
                setLogId: set.id,
                weightKg: weight === "" ? null : Number(weight),
                reps: reps === "" ? null : Number(reps),
                rir: rir === "" ? null : Number(rir),
              });
              setEditing(false);
              onCompleted();
            });
          }}
        >
          <Check className="size-4" />
          {pending ? "Salvando…" : "Concluir série"}
        </Button>
        {set.setType !== "WORKING" || isActive ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Remover série"
            onClick={() => startTransition(() => removeSet(set.id))}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  step: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="h-12 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-center font-mono text-lg font-semibold tabular-nums"
      />
    </label>
  );
}
