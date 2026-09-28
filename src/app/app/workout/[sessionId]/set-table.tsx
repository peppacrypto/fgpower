"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Info, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDecimal, type SetKind } from "@/lib/training/set-plan";
import { formatKg, plural } from "@/lib/utils/format";

export type DraftField = "weight" | "reps" | "rir";

export interface SetTableRowModel {
  id: string;
  kind: SetKind;
  ordinal: number;
  values: Record<DraftField, string>;
  suggestion: { weightKg: number | null; reps: number | null };
  done: boolean;
  /**
   * The row's trip to the server: "sending" until the server confirms it
   * (also while queued behind another save), "pending" once a send failed —
   * it is kept on this device and resent by itself (never "tap ✓ again") —
   * and "held" while the login has expired: it waits for the user to sign in.
   */
  sync: "sending" | "pending" | "held" | null;
  error: string | null;
  /** Only kg or only reps typed: the empty box, flagged — the row won't count. */
  missing: "weight" | "reps" | null;
  /** A ✓'d set that beats the user's record (pr-moment): the row's square "PR" mark. */
  record?: boolean;
}

/** Accessible names of the boxes ("Série 2 — kg"). */
export const FIELD_LABEL: Record<DraftField, string> = { weight: "kg", reps: "repetições", rir: "RIR" };

/** A box's accessible name word; a timed hold's reps box holds seconds ("Série 1 — segundos"). */
export function fieldLabel(field: DraftField, timed = false): string {
  return field === "reps" && timed ? "segundos" : FIELD_LABEL[field];
}

const GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_3rem_2.75rem] items-center gap-1.5";

/**
 * Every set the program prescribes is an open row of boxes (kg · reps · RIR ·
 * ✓), so the whole exercise can be filled at a glance. Warm-ups are optional:
 * folded into one line with their suggested loads until the user opens them
 * to log them. Sets beyond the prescription live in a separate, clearly
 * labelled "Séries extras" block and are only created on demand.
 */
export function SetTable({
  warmups,
  prescribed,
  extras,
  prescribedCount,
  hint,
  onChange,
  onBlurRow,
  onToggle,
  onRemoveExtra,
  onAddExtra,
  addingExtra,
  warmupsOpen,
  onToggleWarmups,
  onExplainRir,
  timed = false,
  flashRowId = null,
}: {
  warmups: SetTableRowModel[];
  prescribed: SetTableRowModel[];
  extras: SetTableRowModel[];
  prescribedCount: number;
  /**
   * What the grey numbers are. `shown`: explained above the rows; `folded`:
   * behind an (i) once the user has used them a few times (`open` while
   * unfolded); `none`: a first time, explained by the callout above instead.
   * Decided outside of typing: it must not appear or vanish under the finger.
   */
  hint: { mode: "shown" | "folded" | "none"; source: "progression" | "last-time"; open: boolean; onToggle: () => void };
  onChange: (id: string, field: DraftField, value: string) => void;
  onBlurRow: (id: string) => void;
  onToggle: (id: string) => void;
  onRemoveExtra: (id: string) => void;
  onAddExtra: () => void;
  addingExtra: boolean;
  warmupsOpen: boolean;
  onToggleWarmups: () => void;
  /** The RIR column header explains RIR (a sheet with the 0–4 scale). */
  onExplainRir: () => void;
  /** A hold: the reps column holds seconds ("seg"). */
  timed?: boolean;
  /** The row whose "PR" mark was just earned: it pops in (once per tap). */
  flashRowId?: { id: string; n: number } | null;
}) {
  const rowProps = { onChange, onBlurRow, onToggle, timed, flashRowId };
  // Rows holding something stay open: a logged warm-up is never hidden.
  const warmupsHaveData = warmups.some((r) => r.done || r.values.weight.trim() !== "" || r.values.reps.trim() !== "");
  const showWarmupRows = warmupsOpen || warmupsHaveData;
  const ramp = warmups
    .filter((r) => r.suggestion.weightKg !== null && r.suggestion.reps !== null)
    .map((r) => `~${formatKg(r.suggestion.weightKg)} × ${r.suggestion.reps}`);
  const hintText = (
    <p className="mb-2 text-[11px] text-muted">
      Números em cinza <span className="italic">em itálico</span> são sugestões
      {hint.source === "progression" ? " (a progressão de hoje)" : " (último treino / série de cima)"}. Toque ✓ para
      usá-los ou digite os seus.
    </p>
  );
  // The column names sit right above the first rows on screen.
  const columns = (
    <div className={cn(GRID, "px-1 pb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted")}>
      <span>Série</span>
      <span className="text-center">kg</span>
      <span className="text-center">{timed ? "seg" : "reps"}</span>
      <button
        type="button"
        onClick={onExplainRir}
        aria-haspopup="dialog"
        aria-label="O que é RIR?"
        className="-my-3 inline-flex items-center justify-center gap-0.5 py-3 uppercase underline decoration-dotted underline-offset-2 hover:text-foreground"
      >
        RIR <Info className="size-3" />
      </button>
      <span className="text-center" aria-hidden>
        ✓
      </span>
    </div>
  );
  return (
    <div className="flex flex-col">
      {hint.mode === "shown" ? hintText : null}

      {warmups.length > 0 ? (
        <section aria-label="Aquecimento" className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <BlockLabel className="mb-0">
              Aquecimento · <span className="text-foreground/70">opcional</span>
            </BlockLabel>
            {warmupsHaveData ? null : (
              <button
                type="button"
                onClick={onToggleWarmups}
                aria-expanded={showWarmupRows}
                aria-label={showWarmupRows ? "Ocultar aquecimento" : "Registrar aquecimento"}
                className="-my-3 inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs font-semibold text-accent"
              >
                {showWarmupRows ? "Ocultar" : "Registrar"}
                <ChevronDown className={cn("size-3.5 transition-transform", showWarmupRows && "rotate-180")} />
              </button>
            )}
          </div>
          {showWarmupRows ? (
            <div className="mt-1.5">
              {columns}
              <div className="flex flex-col gap-1.5">
                {warmups.map((row) => (
                  <SetRowInputs key={row.id} row={row} {...rowProps} />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-muted tabular-nums">
              {plural(warmups.length, "série leve", "séries leves")}
              {ramp.length > 0 ? (
                <>
                  : <span className="font-mono text-foreground/80">{ramp.join(" · ")}</span>
                </>
              ) : (
                " antes da 1ª série — sem registrar, se preferir"
              )}
            </p>
          )}
        </section>
      ) : null}

      <section aria-label="Séries prescritas">
        <div className="flex items-start justify-between gap-2">
          <BlockLabel>
            Séries do treino <span className="text-foreground">· {prescribedCount}</span>
          </BlockLabel>
          {hint.mode === "folded" ? (
            <button
              type="button"
              onClick={hint.onToggle}
              aria-expanded={hint.open}
              aria-label="Como funcionam os números em cinza"
              className="-my-3 -mr-2 flex size-11 shrink-0 items-center justify-center text-muted hover:text-foreground"
            >
              <Info className="size-4" />
            </button>
          ) : null}
        </div>
        {hint.mode === "folded" && hint.open ? hintText : null}
        {warmups.length > 0 && showWarmupRows ? null : columns}
        <div className="flex flex-col gap-1.5">
          {prescribed.map((row) => (
            <SetRowInputs key={row.id} row={row} {...rowProps} />
          ))}
        </div>
      </section>

      {extras.length > 0 ? (
        <section aria-label="Séries extras" className="mt-4 border-t-2 border-dashed border-foreground/35! pt-3">
          <BlockLabel>
            Séries extras <span className="tag tag--mark ml-1 align-middle">além do prescrito</span>
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
        disabled={row.sync === "sending"}
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

function BlockLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted", className)}>
      {children}
    </p>
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
  timed,
  flashRowId,
}: {
  row: SetTableRowModel;
  onChange: (id: string, field: DraftField, value: string) => void;
  onBlurRow: (id: string) => void;
  onToggle: (id: string) => void;
  timed: boolean;
  flashRowId: { id: string; n: number } | null;
}) {
  const name = rowName(row);
  const repsRef = useRef<HTMLInputElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const flashN = flashRowId?.id === row.id ? flashRowId.n : null;
  // The record just earned: the mark pops in (a still mark under reduced motion).
  useEffect(() => {
    const el = markRef.current;
    if (flashN === null || !el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [
        { transform: "scale(0.3)", opacity: 0 },
        { transform: "scale(1.35)", opacity: 1, offset: 0.55 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 480, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  }, [flashN]);
  /**
   * Keyboard flow: "next" on kg jumps to reps; "done" on reps (or RIR)
   * completes the row like ✓ and closes the keyboard, so the rest starts.
   */
  const onEnter = (f: DraftField) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (f === "weight") {
      repsRef.current?.focus();
      return;
    }
    if (!row.done) onToggle(row.id);
    e.currentTarget.blur();
  };
  const field = (f: DraftField, label: string, placeholder: string, inputMode: "decimal" | "numeric") => (
    <input
      ref={f === "reps" ? repsRef : undefined}
      type="text"
      inputMode={inputMode}
      autoComplete="off"
      enterKeyHint={f === "weight" ? "next" : "done"}
      aria-label={`${name} — ${label}`}
      value={row.values[f]}
      placeholder={placeholder}
      onChange={(e) => onChange(row.id, f, e.target.value)}
      onBlur={() => onBlurRow(row.id)}
      onKeyDown={onEnter(f)}
      className={cn(
        "h-11 w-full min-w-0 rounded-[3px] border bg-surface px-1 text-center font-mono text-base font-semibold tabular-nums placeholder:font-normal placeholder:italic placeholder:text-muted",
        // `!`: the global `* { border-color }` rule is unlayered and would win.
        row.done ? "border-accent!" : row.missing === f ? "border-warning! border-2" : "border-foreground/50!",
      )}
    />
  );

  return (
    <div data-set-row={row.id}>
      <div
        className={cn(
          GRID,
          "px-1 py-1",
          row.done ? "bg-accent-soft" : row.kind === "EXTRA" ? "bg-surface-2" : "",
        )}
      >
        <span
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 text-center font-mono text-sm font-bold leading-none tabular-nums",
            row.kind === "WARMUP" ? "text-muted" : row.kind === "EXTRA" ? "text-warning" : "text-foreground",
          )}
        >
          {rowLabel(row)}
          {row.record ? (
            <span
              ref={markRef}
              data-pr-mark
              className="inline-flex size-[18px] items-center justify-center bg-accent text-[8px] font-bold tracking-[0.04em] text-accent-foreground shadow-[inset_0_-2px_0_var(--keel)]"
            >
              PR<span className="sr-only"> · recorde pessoal</span>
            </span>
          ) : null}
        </span>
        {field("weight", FIELD_LABEL.weight, formatDecimal(row.suggestion.weightKg), "decimal")}
        {field("reps", fieldLabel("reps", timed), formatDecimal(row.suggestion.reps), "numeric")}
        {field("rir", "RIR", "–", "decimal")}
        <button
          type="button"
          onClick={() => onToggle(row.id)}
          aria-pressed={row.done}
          aria-label={row.done ? `${name} feita — toque para desfazer` : `Concluir ${name.toLowerCase()}`}
          data-sync={row.sync ?? undefined}
          className={cn(
            "flex size-11 items-center justify-center rounded-[3px] transition-colors",
            row.done
              ? "bg-accent text-accent-foreground shadow-[inset_0_-2px_0_var(--keel)]"
              : "border-2 border-foreground/50! text-foreground/60 hover:border-accent! hover:text-accent",
          )}
        >
          <Check className={cn("size-5", row.sync === "sending" ? "animate-pulse" : "")} strokeWidth={3} />
        </button>
      </div>
      {row.error ? (
        <p role="alert" className="px-1 pt-1 text-[11px] font-medium text-danger">
          {row.error}
        </p>
      ) : row.sync === "pending" || row.sync === "held" ? (
        <p className="px-1 pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warning">
          {row.sync === "held" ? "Pendente · entre de novo" : "Pendente · reenviando"}
        </p>
      ) : null}
    </div>
  );
}
