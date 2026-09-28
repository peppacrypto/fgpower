"use client";

import { useEffect, useRef, useState } from "react";
import { GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";

/** A load asked about at the finish, and where its kg box is. */
export interface LoadQuestion {
  exerciseIndex: number;
  inputLabel: string;
  rowId: string;
  kg: number;
  text: string;
  where: string;
}

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
  /**
   * The first row saved without ✓ whose load is far from the reference ("225"
   * for 22,5, W-088) and wasn't confirmed: it would become a record as typed.
   * `text`: "225 kg? Último: 22,5 kg"; `where`: "Supino Reto · Série 2".
   */
  implausible: LoadQuestion | null;
  /** Exercises (not skipped) with no set recorded. */
  untouchedExercises: string[];
}

/**
 * Explicit end-of-workout confirmation. Replaces the old header button that
 * turned into "Confirmar" and silently disarmed after 4 s — easy to walk away
 * from believing the workout was finished. Says what will be saved, and
 * offers discarding when nothing was recorded. A native modal <dialog> (like
 * the builder's sheets): focus stays inside, the workout behind is inert and
 * doesn't scroll, and Escape / a tap outside close it — never mid-save.
 */
export function FinishSheet({
  stats,
  stale,
  finishing,
  discarding,
  error,
  onFinish,
  onFinishStale,
  onDiscard,
  onClose,
  onReview,
  onReviewLoad,
  onConfirmLoad,
}: {
  stats: FinishStats;
  /**
   * A workout left open since an earlier day: it can be saved as done on that
   * day ("Salvar como feito em 20/09") instead of today. `preferred`: nothing
   * was done in it lately, so that is the first choice; once it was continued
   * today, saving with today's date comes first.
   */
  stale: { since: string; saveAsDay: string; preferred: boolean } | null;
  /** Which save is under way. */
  finishing: "now" | "stale" | null;
  discarding: boolean;
  error: string | null;
  onFinish: () => void;
  onFinishStale: () => void;
  onDiscard: () => void;
  onClose: () => void;
  /** Close the sheet and jump to the incomplete row. */
  onReview: (target: { exerciseIndex: number; inputLabel: string }) => void;
  /** Close the sheet and jump to the load asked about. */
  onReviewLoad: (target: LoadQuestion) => void;
  /** The load asked about is right: saved as typed, never asked again. */
  onConfirmLoad: (rowId: string, kg: number) => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const recorded = stats.prescribedDone + stats.extrasDone;
  const busy = finishing !== null || discarding;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    primaryRef.current?.focus();
    // The page under a modal dialog must not scroll along (iOS drags through the backdrop).
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  const untouched = stats.untouchedExercises;

  /** The two saves of a workout left open: on its own day, or with today's date. */
  const saveButton = (mode: "now" | "stale", primary: boolean) => (
    <Button
      ref={primary ? primaryRef : undefined}
      size="lg"
      variant={primary ? "strong" : "secondary"}
      className="w-full"
      disabled={busy}
      onClick={mode === "stale" ? onFinishStale : onFinish}
    >
      {primary ? <GCheck className="size-4" /> : null}
      {finishing === mode
        ? "Salvando…"
        : mode === "stale"
          ? `Salvar como feito em ${stale?.saveAsDay}`
          : "Salvar com data de hoje"}
    </Button>
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="finish-title"
      aria-describedby={stats.implausible ? "finish-load-check" : undefined}
      // Escape: back to the workout (never mid-save). The parent unmounts the
      // sheet, so the native close is always prevented.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/45"
    >
      <div className="flex h-full w-full items-end justify-center sm:items-center" onClick={busy ? undefined : onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          // Never taller than the space below the status bar (installed PWA draws under it).
          className="panel-raised max-h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full max-w-lg overflow-y-auto overscroll-contain bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">Fim do treino</span>
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

          {stats.implausible ? (
            // Before the save button: the number is checked before it becomes a record.
            <div id="finish-load-check" className="mt-3 border-l-2 border-l-warning! bg-warning-soft px-3 py-2" data-finish-load-check>
              <p className="text-sm font-semibold text-foreground">{stats.implausible.text}</p>
              <p className="mt-0.5 text-xs text-foreground/80 wrap-break-word">
                {stats.implausible.where} · sem ✓ — será salva assim e pode virar recorde.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  className="px-3"
                  disabled={busy}
                  onClick={() => stats.implausible && onReviewLoad(stats.implausible)}
                >
                  Corrigir
                </Button>
                <Button
                  variant="ghost"
                  className="px-3"
                  disabled={busy}
                  onClick={() => {
                    if (stats.implausible) onConfirmLoad(stats.implausible.rowId, stats.implausible.kg);
                    // This box goes away: focus stays in the sheet, on the save.
                    primaryRef.current?.focus();
                  }}
                >
                  Está certo
                </Button>
              </div>
            </div>
          ) : null}

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

          {stale && recorded > 0 ? (
            <p className="mt-3 border-l-2 border-l-warning bg-warning-soft px-3 py-2 text-xs text-foreground/90">
              {stale.preferred ? (
                <>
                  <span className="font-semibold">Este treino ficou aberto desde {stale.since}.</span> Salve-o no dia em que
                  foi feito para ele não contar como treino de hoje.
                </>
              ) : (
                <>
                  <span className="font-semibold">Treino aberto desde {stale.since}.</span> Salve com a data de hoje ou como
                  feito em {stale.saveAsDay}.
                </>
              )}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 border-l-2 border-l-danger! bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            {recorded > 0 && stale ? (
              stale.preferred ? (
                <>
                  {saveButton("stale", true)}
                  {saveButton("now", false)}
                </>
              ) : (
                <>
                  {saveButton("now", true)}
                  {saveButton("stale", false)}
                </>
              )
            ) : recorded > 0 ? (
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
    </dialog>
  );
}
