"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Asked when the user taps a link (bottom nav, back link…) with unsaved
 * builder changes — leaving used to drop them silently. A native modal
 * <dialog> (like the exercise picker), so focus stays inside and the page
 * behind is inert while it is up.
 */
export function LeaveSheet({
  saving,
  onSaveAndLeave,
  onDiscard,
  onStay,
}: {
  saving: boolean;
  onSaveAndLeave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    primaryRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="leave-title"
      aria-describedby="leave-desc"
      // Escape: stay (never mid-save). The parent unmounts the sheet, so the
      // native close is always prevented; if the browser closes it anyway,
      // stay too so the state matches the screen.
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onStay();
      }}
      onClose={onStay}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/45"
    >
      <div className="flex h-full w-full items-end justify-center sm:items-center" onClick={saving ? undefined : onStay}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="panel-raised max-h-[100dvh] w-full max-w-lg overflow-y-auto overscroll-contain bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        >
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-warning">Alterações não salvas</span>
          <h2 id="leave-title" className="text-display mt-1 text-2xl font-extrabold">
            Sair sem salvar?
          </h2>
          <p id="leave-desc" className="mt-2 text-sm text-muted">
            Você mudou este programa e ainda não salvou. Se sair agora, essas mudanças se perdem.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <Button ref={primaryRef} size="lg" variant="strong" className="w-full" disabled={saving} onClick={onSaveAndLeave}>
              {saving ? "Salvando…" : "Salvar e sair"}
            </Button>
            <Button size="lg" variant="ghost" className="w-full" disabled={saving} onClick={onStay}>
              Continuar editando
            </Button>
          </div>

          <div className="mt-4 border-t border-border pt-3 text-center">
            <button
              type="button"
              disabled={saving}
              onClick={onDiscard}
              className="min-h-11 px-3 text-xs font-medium text-muted hover:text-danger disabled:opacity-40"
            >
              Descartar e sair
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
