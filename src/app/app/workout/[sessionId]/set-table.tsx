"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDecimal, type SetKind } from "@/lib/training/set-plan";

export type DraftField = "weight" | "reps" | "rir";

export interface SetTableRowModel {
  id: string;
  kind: SetKind;
  ordinal: number;
  values: Record<DraftField, string>;
  suggestion: { weightKg: number | null; reps: number | null };
  done: boolean;
  saving: boolean;
  error: string | null;
  /** Only kg or only reps typed: the empty box, flagged — the row won't count. */
  missing: "weight" | "reps" | null;
}

/** Accessible names of the boxes ("Série 2 — kg"). */
export const FIELD_LABEL: Record<DraftField, string> = { weight: "kg", reps: "repetições", rir: "RIR" };

const GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_3rem_2.75rem] items-center gap-1.5";

/**
 * Every set the program prescribes is an open row of boxes (kg · reps · RIR ·
 * ✓), so the whole exercise can be filled at a glance. Warm-ups sit in their
 * own block above; sets beyond the prescription live in a separate, clearly
 * labelled "Séries extras" block and are only created on demand.
 */
export function SetTable({
  warmups,
  prescribed,
  extras,
  prescribedCount,
  onChange,
  onBlurRow,
  onToggle,
  onRemoveExtra,
  onAddExtra,
  addingExtra,
}: {
  warmups: SetTableRowModel[];
  prescribed: SetTableRowModel[];
  extras: SetTableRowModel[];
  prescribedCount: number;
  onChange: (id: string, field: DraftField, value: string) => void;
  onBlurRow: (id: string) => void;
  onToggle: (id: string) => void;
  onRemoveExtra: (id: string) => void;
  onAddExtra: () => void;
  addingExtra: boolean;
}) {
  const rowProps = { onChange, onBlurRow, onToggle };
  return (
    <div className="flex flex-col">
      {/* Always rendered: toggling it while typing shifted the rows under the finger. */}
      <p className="mb-2 text-[11px] text-muted">
        Números em cinza <span className="italic">em itálico</span> são sugestões (último treino / série de cima).
        Toque ✓ para usá-los ou digite os seus.
      </p>
      <div className={cn(GRID, "px-1 pb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted")}>
        <span>Série</span>
        <span className="text-center">kg</span>
        <span className="text-center">reps</span>
        <span className="text-center">RIR</span>
        <span className="text-center" aria-hidden>
          ✓
        </span>
      </div>

      {warmups.length > 0 ? (
        <section aria-label="Aquecimento" className="mb-3">
          <BlockLabel>Aquecimento</BlockLabel>
          <div className="flex flex-col gap-1.5">
            {warmups.map((row) => (
              <SetRowInputs key={row.id} row={row} {...rowProps} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="Séries prescritas">
        <BlockLabel>
          Séries do treino <span className="text-foreground">· {prescribedCount}</span>
        </BlockLabel>
        <div className="flex flex-col gap-1.5">
          {prescribed.map((row) => (
            <SetRowInputs key={row.id} row={row} {...rowProps} />
          ))}
        </div>
      </section>

      {extras.length > 0 ? (
        <section aria-label="Séries extras" className="mt-4 border-t-2 border-dashed border-foreground/35! pt-3">
          <BlockLabel>
            Séries extras <span className="tag tag--mark ml-1 align-middle text-[9px]">além do prescrito</span>
          </BlockLabel>
          <div className="flex flex-col gap-2.5">
            {extras.map((row) => (
              <div key={row.id}>
                <SetRowInputs row={row} {...rowProps} />
                <RemoveExtraButton row={row} onRemove={() => onRemoveExtra(row.id)} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={onAddExtra}
        disabled={addingExtra}
        className="mt-4 flex min-h-12 w-full flex-wrap items-center justify-center gap-x-2 border-2 border-dashed border-foreground/35! px-3 py-2 text-sm font-semibold text-foreground/80 hover:border-accent! hover:text-accent disabled:opacity-50"
      >
        <Plus className="size-4" />
        {addingExtra ? "Adicionando…" : "Adicionar série extra"}
        <span className="font-normal text-muted">
          · {prescribedCount === 1 ? "além da série do treino" : `além das ${prescribedCount} do treino`}
        </span>
      </button>
    </div>
  );
}

/**
 * Left-aligned, away from the ✓ column; a row with values asks once more
 * ("Remover?") so a tap that lands low on ✓ can't delete a logged set.
 */
function RemoveExtraButton({ row, onRemove }: { row: SetTableRowModel; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  const hasValues = row.values.weight.trim() !== "" || row.values.reps.trim() !== "";
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <div className="mt-1 flex justify-start">
      <button
        type="button"
        onClick={() => {
          if (hasValues && !armed) setArmed(true);
          else onRemove();
        }}
        disabled={row.saving}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 px-1 text-xs disabled:opacity-40",
          armed ? "font-semibold text-danger" : "text-muted hover:text-danger",
        )}
      >
        <Trash2 className="size-3.5" />
        {armed ? `Remover extra ${row.ordinal}? Toque de novo` : `Remover extra ${row.ordinal}`}
      </button>
    </div>
  );
}

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{children}</p>
  );
}

function rowLabel(row: SetTableRowModel) {
  if (row.kind === "WARMUP") return `A${row.ordinal}`;
  if (row.kind === "EXTRA") return `E${row.ordinal}`;
  return String(row.ordinal);
}

export function rowName(row: Pick<SetTableRowModel, "kind" | "ordinal">) {
  if (row.kind === "WARMUP") return `Aquecimento ${row.ordinal}`;
  if (row.kind === "EXTRA") return `Série extra ${row.ordinal}`;
  return `Série ${row.ordinal}`;
}

function SetRowInputs({
  row,
  onChange,
  onBlurRow,
  onToggle,
}: {
  row: SetTableRowModel;
  onChange: (id: string, field: DraftField, value: string) => void;
  onBlurRow: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const name = rowName(row);
  const field = (f: DraftField, label: string, placeholder: string, inputMode: "decimal" | "numeric") => (
    <input
      type="text"
      inputMode={inputMode}
      autoComplete="off"
      enterKeyHint="done"
      aria-label={`${name} — ${label}`}
      value={row.values[f]}
      placeholder={placeholder}
      onChange={(e) => onChange(row.id, f, e.target.value)}
      onBlur={() => onBlurRow(row.id)}
      className={cn(
        "h-11 w-full min-w-0 rounded-[3px] border bg-surface px-1 text-center font-mono text-base font-semibold tabular-nums placeholder:font-normal placeholder:italic placeholder:text-muted",
        // `!`: the global `* { border-color }` rule is unlayered and would win.
        row.done ? "border-accent!" : row.missing === f ? "border-warning! border-2" : "border-foreground/50!",
      )}
    />
  );

  return (
    <div>
      <div
        className={cn(
          GRID,
          "px-1 py-1",
          row.done ? "bg-accent-soft" : row.kind === "EXTRA" ? "bg-surface-2" : "",
        )}
      >
        <span
          className={cn(
            "text-center font-mono text-sm font-bold tabular-nums",
            row.kind === "WARMUP" ? "text-muted" : row.kind === "EXTRA" ? "text-warning" : "text-foreground",
          )}
        >
          {rowLabel(row)}
        </span>
        {field("weight", FIELD_LABEL.weight, formatDecimal(row.suggestion.weightKg), "decimal")}
        {field("reps", FIELD_LABEL.reps, formatDecimal(row.suggestion.reps), "numeric")}
        {field("rir", "RIR", "–", "decimal")}
        <button
          type="button"
          onClick={() => onToggle(row.id)}
          disabled={row.saving}
          aria-pressed={row.done}
          aria-label={row.done ? `${name} feita — toque para desfazer` : `Concluir ${name.toLowerCase()}`}
          className={cn(
            "flex size-11 items-center justify-center rounded-[3px] transition-colors disabled:opacity-60",
            row.done
              ? "bg-accent text-accent-foreground shadow-[inset_0_-2px_0_var(--keel)]"
              : "border-2 border-foreground/50! text-foreground/60 hover:border-accent! hover:text-accent",
          )}
        >
          <Check className={cn("size-5", row.saving ? "animate-pulse" : "")} strokeWidth={3} />
        </button>
      </div>
      {row.error ? (
        <p role="alert" className="px-1 pt-1 text-[11px] font-medium text-danger">
          {row.error}
        </p>
      ) : null}
    </div>
  );
}
