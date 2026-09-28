"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A bottom sheet of actions (the builder's row and day menus, a profile's
 * "⋯", a report form). Born in the builder, where each row used to carry its
 * own 32px Duplicar and Remover side by side — one mis-tap deleted tuned
 * numbers. A native modal <dialog>: focus stays inside, Escape or a tap
 * outside closes it, and every item is a 44px row. Focus starts on the item
 * marked `initial`, else the first one. The parent unmounts it to close (no
 * native close event: an action's own focus target must not be overridden by
 * a late "closed" callback).
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
    (
      dialog?.querySelector<HTMLElement>("[data-sheet-initial]:not(:disabled)") ??
      dialog?.querySelector<HTMLElement>("[data-sheet-item]:not(:disabled), button:not(:disabled)")
    )?.focus();
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
  initial,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Takes the focus when the sheet opens (a confirm starts on its safe choice). */
  initial?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-sheet-item
      data-sheet-initial={initial ? "" : undefined}
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

/**
 * "Deixar de seguir @ana?" — a yes/no sheet for an action that is hard to take
 * back (unfollow, remove a follower, block, delete a post). Built on
 * ActionSheet: the confirm row (danger when destructive) and the cancel row.
 * Focus starts on cancel, never on the destructive choice, and goes back to
 * the button that opened it when the sheet closes. Escape or a tap outside
 * cancels. While `pending`, the confirm row is disabled and reads
 * `pendingLabel` ("Saindo…"); the parent unmounts the sheet when done.
 */
export function ConfirmSheet({
  title,
  subtitle,
  confirmLabel,
  cancelLabel = "Cancelar",
  danger = false,
  pending = false,
  pendingLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // The element that had focus when the sheet was rendered (its trigger),
  // read before ActionSheet's effect moves focus into the dialog.
  const [trigger] = useState(() => (typeof document === "undefined" ? null : document.activeElement));
  useEffect(
    () => () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) requestAnimationFrame(() => trigger.focus());
    },
    [trigger],
  );

  return (
    <ActionSheet title={title} subtitle={subtitle} onClose={pending ? () => {} : onClose} labelledBy="confirm-sheet-title">
      <SheetItem onClick={onConfirm} danger={danger} disabled={pending}>
        {pending && pendingLabel ? pendingLabel : confirmLabel}
      </SheetItem>
      <SheetItem onClick={onClose} disabled={pending} initial>
        {cancelLabel}
      </SheetItem>
    </ActionSheet>
  );
}
