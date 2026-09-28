"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";
import { Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { editFinishedWorkout, type FinishedSetEdit } from "@/lib/actions/workouts";
import { parseDecimalInput } from "@/lib/training/set-plan";
import { cn } from "@/lib/utils/cn";

export interface EditableExercise {
  logId: string;
  name: string;
  /** A hold: the reps are seconds. */
  timed: boolean;
  sets: { id: string; label: string; name: string; weight: string; reps: string; rir: string }[];
}

type Row = { weight: string; reps: string; rir: string; removed: boolean };

const GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_3rem_2.75rem] items-center gap-1.5";

/** A Next.js navigation thrown through an action (the save's redirect to the summary). */
function isNavigation(err: unknown) {
  try {
    unstable_rethrow(err);
    return false;
  } catch {
    return true;
  }
}

/**
 * The finished workout's counted sets as boxes — the workout screen's grid —
 * to correct or take out. Only what changed is sent; the server checks the
 * window, the rows and that a working set is left.
 */
export function EditSetsForm({
  sessionId,
  exercises,
  summaryHref,
}: {
  sessionId: string;
  exercises: EditableExercise[];
  summaryHref: string;
}) {
  const initial = Object.fromEntries(
    exercises.flatMap((ex) => ex.sets.map((s) => [s.id, { weight: s.weight, reps: s.reps, rir: s.rir, removed: false }])),
  ) as Record<string, Row>;
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (id: string, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
    if (invalid.has(id)) {
      const next = new Set(invalid);
      next.delete(id);
      setInvalid(next);
    }
  };

  function save() {
    setError(null);
    const edits: FinishedSetEdit[] = [];
    const bad = new Set<string>();
    for (const [id, row] of Object.entries(rows)) {
      const before = initial[id];
      if (row.removed) {
        edits.push({ setLogId: id, weightKg: null, reps: null, rir: null, remove: true });
        continue;
      }
      if (row.weight === before.weight && row.reps === before.reps && row.rir === before.rir) continue;
      const weightKg = parseDecimalInput(row.weight);
      const reps = parseDecimalInput(row.reps);
      const rir = parseDecimalInput(row.rir);
      if (weightKg === null || reps === null || reps < 1 || (row.rir.trim() !== "" && rir === null)) {
        bad.add(id);
        continue;
      }
      edits.push({ setLogId: id, weightKg, reps: Math.round(reps), rir });
    }
    setInvalid(bad);
    if (bad.size > 0) {
      setError("Preencha kg e reps das séries marcadas — ou tire a série.");
      return;
    }
    if (Object.values(rows).every((r) => r.removed)) {
      setError("Sem nenhuma série o treino não existe: para isso, use “Excluir treino” no resumo.");
      return;
    }
    if (edits.length === 0) {
      setError("Nada mudou.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await editFinishedWorkout(sessionId, edits);
        setError(
          r.reason === "EXPIRED"
            ? "O prazo para corrigir este treino acabou (24 h depois de finalizado)."
            : r.reason === "EMPTY"
              ? "Sem nenhuma série o treino não existe: para isso, use “Excluir treino” no resumo."
              : "Não foi possível salvar. Atualize a página e tente de novo.",
        );
      } catch (err) {
        // Saved: the action is opening the summary.
        if (isNavigation(err)) return;
        if (unstable_isUnrecognizedActionError(err)) {
          window.location.reload();
          return;
        }
        setError("Sem conexão — nada foi alterado. Tente de novo quando o sinal voltar.");
      }
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {exercises.map((ex, i) => (
        <section key={ex.logId} aria-labelledby={`edit-${ex.logId}`}>
          <div className="flex items-baseline gap-3 border-b border-border pb-1.5">
            <span className="w-5 shrink-0 font-mono text-xs text-foreground/40">{String(i + 1).padStart(2, "0")}</span>
            <h2 id={`edit-${ex.logId}`} className="min-w-0 flex-1 text-sm font-semibold leading-snug wrap-break-word">
              {ex.name}
            </h2>
          </div>
          <div className={cn(GRID, "px-1 pb-1.5 pt-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted")}>
            <span>Série</span>
            <span className="text-center">kg</span>
            <span className="text-center">{ex.timed ? "seg" : "reps"}</span>
            <span className="text-center">RIR</span>
            <span aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            {ex.sets.map((s) => {
              const row = rows[s.id];
              const bad = invalid.has(s.id);
              const box = (field: "weight" | "reps" | "rir", label: string, inputMode: "decimal" | "numeric") => (
                <input
                  type="text"
                  inputMode={inputMode}
                  autoComplete="off"
                  aria-label={`${s.name} — ${label}`}
                  aria-invalid={bad && field !== "rir" ? true : undefined}
                  disabled={row.removed || pending}
                  value={row[field]}
                  placeholder={field === "rir" ? "–" : undefined}
                  onChange={(e) => change(s.id, { [field]: e.target.value })}
                  className={cn(
                    "h-11 w-full min-w-0 rounded-[3px] border bg-surface px-1 text-center font-mono text-base font-semibold tabular-nums placeholder:font-normal placeholder:text-muted disabled:opacity-40",
                    bad && field !== "rir" ? "border-2 border-warning!" : "border-foreground/50!",
                  )}
                />
              );
              return (
                <div key={s.id} data-edit-row={s.id}>
                  <div className={cn(GRID, "px-1 py-1", row.removed && "bg-surface-2")}>
                    <span
                      className={cn(
                        "text-center font-mono text-sm font-bold tabular-nums",
                        s.label.startsWith("E") ? "text-warning" : "text-foreground",
                        row.removed && "line-through opacity-50",
                      )}
                    >
                      {s.label}
                    </span>
                    {box("weight", "kg", "decimal")}
                    {box("reps", ex.timed ? "segundos" : "repetições", "numeric")}
                    {box("rir", "RIR", "decimal")}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => change(s.id, { removed: !row.removed })}
                      aria-pressed={row.removed}
                      aria-label={row.removed ? `Manter ${s.name.toLowerCase()}` : `Tirar ${s.name.toLowerCase()}`}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-[3px] border",
                        row.removed ? "border-accent text-accent" : "border-border text-muted hover:border-danger hover:text-danger",
                      )}
                    >
                      {row.removed ? <Undo2 className="size-4" /> : <Trash2 className="size-4" />}
                    </button>
                  </div>
                  {row.removed ? (
                    <p className="px-1 pt-0.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      Sai do treino ao salvar
                    </p>
                  ) : bad ? (
                    <p className="px-1 pt-0.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-warning">
                      Falta kg ou reps
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {error ? (
        <p role="alert" className="border-l-2 border-l-danger! bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" variant="strong" className="w-full sm:w-auto" disabled={pending} onClick={save}>
          {pending ? "Salvando…" : "Salvar correções"}
        </Button>
        <Button size="lg" variant="ghost" className="w-full sm:w-auto" disabled={pending} asChild>
          <Link href={summaryHref}>Cancelar</Link>
        </Button>
      </div>
    </div>
  );
}
