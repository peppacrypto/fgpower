"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A bottom sheet of actions for one exercise row or one day of the builder
 * ("Mover para…", "Duplicar", "Remover"). Each row used to carry its own
 * 32px Duplicar and Remover side by side — one mis-tap deleted tuned numbers.
 * A native modal <dialog> (like the leave sheet): focus stays inside, Escape
 * or a tap outside closes it, and every item is a 44px row. The parent
 * unmounts it to close (no native close event: an action's own focus target
 * must not be overridden by a late "closed" callback).
 */
export function ActionSheet({
  title,
  subtitle,
  onClose,
  children,
  labelledBy = "action-sheet-title",
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector<HTMLElement>("[data-sheet-item]:not(:disabled), button:not(:disabled)")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/45"
    >
      <div className="flex h-full w-full items-end justify-center sm:items-center" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="panel-raised max-h-[100dvh] w-full max-w-lg overflow-y-auto overscroll-contain bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4"
        >
          <div className="px-5 pb-2">
            <h2 id={labelledBy} className="text-base font-bold leading-snug wrap-break-word">
              {title}
            </h2>
            {subtitle ? <div className="mt-1 text-sm text-muted">{subtitle}</div> : null}
          </div>
          <div className="flex flex-col border-t border-border">{children}</div>
        </div>
      </div>
    </dialog>
  );
}

export function SheetItem({
  onClick,
  disabled,
  danger,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-sheet-item
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 border-b border-border px-5 text-left text-[15px] font-medium hover:bg-surface-2 disabled:opacity-35 [&_svg]:size-4 [&_svg]:shrink-0",
        danger ? "text-danger" : "text-foreground",
      )}
    >
      {icon ? <span className={danger ? undefined : "text-muted"}>{icon}</span> : null}
      <span className="min-w-0 flex-1 wrap-break-word">{children}</span>
    </button>
  );
}
