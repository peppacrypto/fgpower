"use client";

import { useEffect, useRef, useState } from "react";
import { GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";

export interface FinishStats {
  prescribedDone: number;
  prescribedTotal: number;
  extrasDone: number;
  /** Rows with load and reps typed but ✓ not tapped — they will be saved. */
  unconfirmed: number;
  /** Rows with only kg or only reps — they will NOT be saved. */
  incomplete: number;
  /** Where the first incomplete row is: its exercise and the empty box's label. */
  firstIncomplete: { exerciseIndex: number; inputLabel: string } | null;
  /** Exercises (not skipped) with no set recorded. */
  untouchedExercises: string[];
}

/**
 * Explicit end-of-workout confirmation. Replaces the old header button that
 * turned into "Confirmar" and silently disarmed after 4 s — easy to walk away
 * from believing the workout was finished. Says what will be saved, and
 * offers discarding when nothing was recorded.
 */
export function FinishSheet({
  stats,
  finishing,
  discarding,
  error,
  onFinish,
  onDiscard,
  onClose,
  onReview,
}: {
  stats: FinishStats;
  finishing: boolean;
  discarding: boolean;
  error: string | null;
  onFinish: () => void;
  onDiscard: () => void;
  onClose: () => void;
  /** Close the sheet and jump to the incomplete row. */
  onReview: (target: { exerciseIndex: number; inputLabel: string }) => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const recorded = stats.prescribedDone + stats.extrasDone;
  const busy = finishing || discarding;

  // The parent re-renders every second (elapsed clock): read the latest
  // callbacks through a ref so focus and the Esc listener are set up once.
  const latest = useRef({ busy, onClose });
  useEffect(() => {
    latest.current = { busy, onClose };
  });
  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !latest.current.busy) latest.current.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const untouched = stats.untouchedExercises;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finish-title"
        onClick={(e) => e.stopPropagation()}
        className="panel-raised max-h-[100dvh] w-full max-w-lg overflow-y-auto overscroll-contain bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
      >
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Fim do treino</span>
        <h2 id="finish-title" className="text-display mt-1 text-2xl font-extrabold">
          {recorded > 0 ? "Finalizar e salvar?" : "Nenhuma série registrada"}
        </h2>

        {recorded > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-border border-y border-border font-mono text-sm tabular-nums">
            <li className="flex items-center justify-between py-2.5">
              <span className="font-sans text-foreground/90">Séries do treino</span>
              <span className="font-bold">
                {stats.prescribedDone}
                <span className="text-muted"> / {stats.prescribedTotal}</span>
              </span>
            </li>
            {stats.extrasDone > 0 ? (
              <li className="flex items-center justify-between py-2.5">
                <span className="font-sans text-foreground/90">Séries extras</span>
                <span className="font-bold">+{stats.extrasDone}</span>
              </li>
            ) : null}
            {stats.unconfirmed > 0 ? (
              <li className="py-2.5 font-sans text-xs text-muted">
                {stats.unconfirmed === 1
                  ? "1 série preenchida sem ✓ também será salva."
                  : `${stats.unconfirmed} séries preenchidas sem ✓ também serão salvas.`}
              </li>
            ) : null}
            {untouched.length > 0 ? (
              <li className="py-2.5 font-sans text-xs text-muted">
                Sem registro: {untouched.slice(0, 3).join(", ")}
                {untouched.length > 3 ? ` e mais ${untouched.length - 3}` : ""}.
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Preencha kg e reps de pelo menos uma série para salvar este treino — ou descarte-o se não vai treinar agora.
          </p>
        )}

        {stats.incomplete > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3 border-l-2 border-l-warning! bg-warning-soft px-3 py-2">
            <p className="text-xs text-foreground/90">
              {stats.incomplete === 1
                ? "1 série está incompleta (falta kg ou reps) e não será salva."
                : `${stats.incomplete} séries estão incompletas (falta kg ou reps) e não serão salvas.`}
            </p>
            {stats.firstIncomplete ? (
              <Button
                variant="outline"
                className="shrink-0 px-3"
                disabled={busy}
                onClick={() => stats.firstIncomplete && onReview(stats.firstIncomplete)}
              >
                Revisar
              </Button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 border-l-2 border-l-danger! bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {recorded > 0 ? (
            <Button ref={primaryRef} size="lg" variant="strong" className="w-full" disabled={busy} onClick={onFinish}>
              <GCheck className="size-4" />
              {finishing ? "Salvando…" : "Finalizar e salvar"}
            </Button>
          ) : null}
          <Button
            ref={recorded > 0 ? undefined : primaryRef}
            size="lg"
            variant={recorded > 0 ? "ghost" : "primary"}
            className="w-full"
            disabled={busy}
            onClick={onClose}
          >
            Continuar treinando
          </Button>
        </div>

        <div className="mt-4 border-t border-border pt-3 text-center">
          {confirmDiscard ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted">O treino não será salvo nem contará no programa.</p>
              <div className="flex gap-2">
                <Button variant="danger" disabled={busy} onClick={onDiscard}>
                  {discarding ? "Descartando…" : "Sim, descartar"}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmDiscard(false)}>
                  Não
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDiscard(true)}
              className="min-h-11 px-3 text-xs font-medium text-muted hover:text-danger disabled:opacity-40"
            >
              Descartar treino
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
