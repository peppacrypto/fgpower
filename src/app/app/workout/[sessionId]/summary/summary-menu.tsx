"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWorkoutSession } from "@/lib/actions/workouts";

/** A Next.js navigation thrown through an action (the delete's redirect to Today). */
function isNavigation(err: unknown) {
  try {
    unstable_rethrow(err);
    return false;
  } catch {
    return true;
  }
}

/**
 * The summary's "⋯" (W-088): for a day after finishing, the sets can be
 * corrected ("Editar séries") and the workout deleted ("Excluir treino") —
 * a typo ("225" for 22,5) or a test workout must not stay in the history,
 * the records and the week's count for good.
 */
export function SummaryMenu({
  sessionId,
  sessionName,
  until,
  untilTime,
  latest,
}: {
  sessionId: string;
  sessionName: string;
  /** Until when it can be corrected: "sáb 27 set" and "14:05". */
  until: string;
  untilTime: string;
  /**
   * No workout was finished after it: deleting it also puts the program's week
   * and next day back. After a newer one, only the count goes (rollBackProgram).
   */
  latest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The menu closes on a tap outside it and on Escape (focus back on "⋯").
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative -mr-1 -mt-1.5 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`summary-menu-${sessionId}`}
        aria-label="Opções do treino"
        className="flex size-11 items-center justify-center text-muted hover:bg-[var(--border)] hover:text-foreground"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open ? (
        <div
          id={`summary-menu-${sessionId}`}
          className="absolute right-0 top-full z-30 w-64 max-w-[calc(100vw-2rem)] border border-border border-t-2 border-t-[var(--rule-heavy)] bg-background shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
        >
          <ul className="flex flex-col divide-y divide-border">
            <li>
              <Link
                href={`/app/workout/${sessionId}/summary/editar`}
                className="flex min-h-12 items-center gap-2.5 px-4 text-sm font-semibold hover:bg-surface-2"
              >
                <Pencil className="size-4 text-muted" />
                Editar séries
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirming(true);
                }}
                aria-haspopup="dialog"
                className="flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-sm font-semibold text-danger hover:bg-surface-2"
              >
                <Trash2 className="size-4" />
                Excluir treino
              </button>
            </li>
          </ul>
          <p className="border-t border-border px-4 py-2 font-mono text-xs text-muted">
            Correções até {until}, {untilTime}
          </p>
        </div>
      ) : null}
      {confirming ? (
        <DeleteSheet
          sessionId={sessionId}
          sessionName={sessionName}
          latest={latest}
          onClose={() => {
            setConfirming(false);
            triggerRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

/** "Excluir este treino?" — a native modal <dialog>, the danger action second to "Cancelar". */
function DeleteSheet({
  sessionId,
  sessionName,
  latest,
  onClose,
}: {
  sessionId: string;
  sessionName: string;
  latest: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
  }, []);

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await deleteWorkoutSession(sessionId);
        setError(
          r.reason === "EXPIRED"
            ? "O prazo para excluir este treino acabou (24 h depois de finalizado)."
            : "Não foi possível excluir. Atualize a página e tente de novo.",
        );
      } catch (err) {
        // The delete went through: the action is opening Today.
        if (isNavigation(err)) return;
        if (unstable_isUnrecognizedActionError(err)) {
          window.location.reload();
          return;
        }
        setError("Sem conexão — o treino continua salvo. Tente de novo quando o sinal voltar.");
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="delete-title"
      aria-describedby="delete-desc"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/45"
    >
      <div className="flex h-full w-full items-end justify-center sm:items-center" onClick={pending ? undefined : onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="panel-raised max-h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full max-w-lg overflow-y-auto overscroll-contain bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-danger">Excluir treino</span>
          <h2 id="delete-title" className="text-display mt-1 text-2xl font-extrabold wrap-break-word">
            Excluir “{sessionName}”?
          </h2>
          <p id="delete-desc" className="mt-2 text-sm text-muted">
            {latest
              ? "As séries e os recordes deste treino somem, e a semana e o programa voltam a contar como se ele não tivesse acontecido. Não dá para desfazer."
              : "As séries e os recordes deste treino somem e ele deixa de contar no programa. Não dá para desfazer."}
          </p>
          {error ? (
            <p role="alert" className="mt-3 border-l-2 border-l-danger! bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-col gap-2">
            <Button ref={cancelRef} size="lg" variant="ghost" className="w-full" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button size="lg" variant="danger" className="w-full" disabled={pending} onClick={remove}>
              <Trash2 className="size-4" />
              {pending ? "Excluindo…" : "Excluir treino"}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
