"use client";

import { useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { cn } from "@/lib/utils/cn";

type Action = (formData: FormData) => void | Promise<void>;

const ITEM =
  "flex min-h-11 w-full items-center justify-start px-3.5 text-left text-sm font-medium text-foreground hover:bg-surface-2";

/**
 * The program page's "⋯": the actions that aren't the main one — Duplicar
 * (opens the copy in the builder), Arquivar and, for a program never trained, Excluir. Arquivar on the active
 * program asks first ("Isto encerra o programa ativo e sua semana atual"), and
 * so does Excluir. Native <details> all the way down, so it opens and confirms
 * before the page has hydrated; a tap outside or Esc closes it.
 */
export function ProgramMenu({
  duplicate,
  archive,
  remove,
}: {
  duplicate: Action;
  /** Null for an archived program. `active` names what archiving ends ("semana 3 de 13"). */
  archive: { action: Action; active: { progress: string } | null } | null;
  /** Only for a program never trained (and not running). */
  remove: Action | null;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const close = (e: Event) => {
      if (!menu.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        menu.open = false;
        menu.querySelector("summary")?.focus();
        return;
      }
      if (e.target instanceof Node && !menu.contains(e.target)) menu.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={menuRef} className="group/menu relative" data-testid="program-menu">
      <summary
        aria-label="Mais ações"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-none text-muted hover:bg-surface-2 hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="size-5" />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] border-y-2 border-[var(--rule-heavy)] bg-surface py-1 shadow-lg">
        <form action={duplicate}>
          <SubmitButton variant="ghost" className={ITEM} pendingLabel="Duplicando…">
            Duplicar
          </SubmitButton>
        </form>
        {archive ? (
          archive.active ? (
            <Confirm
              label="Arquivar"
              text={
                <>
                  Isto encerra o programa ativo e sua semana atual ({archive.active.progress}). Seus treinos ficam no
                  histórico, e você pode retomá-lo em Arquivados.
                </>
              }
              confirm="Arquivar"
              pending="Arquivando…"
              action={archive.action}
            />
          ) : (
            <form action={archive.action}>
              <SubmitButton variant="ghost" className={ITEM} pendingLabel="Arquivando…">
                Arquivar
              </SubmitButton>
            </form>
          )
        ) : null}
        {remove ? (
          <Confirm
            label="Excluir"
            danger
            text={<>O programa é apagado de vez. Ele nunca foi treinado, então nenhum histórico se perde.</>}
            confirm="Excluir"
            pending="Excluindo…"
            action={remove}
          />
        ) : null}
      </div>
    </details>
  );
}

/** A menu item that asks before it acts (a nested native <details>). */
function Confirm({
  label,
  text,
  confirm,
  pending,
  action,
  danger = false,
}: {
  label: string;
  text: React.ReactNode;
  confirm: string;
  pending: string;
  action: Action;
  danger?: boolean;
}) {
  return (
    <details
      className="group/confirm"
      onToggle={(e) => {
        if (e.currentTarget.open) e.currentTarget.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
      }}
    >
      <summary
        className={cn(
          ITEM,
          "cursor-pointer list-none group-open/confirm:hidden [&::-webkit-details-marker]:hidden",
          danger && "text-danger",
        )}
      >
        {label}…
      </summary>
      <InlineActionForm action={action} failText="Não foi possível concluir. Tente de novo." className="flex flex-col gap-2.5 px-3.5 py-3">
        <p role="alert" className="text-sm leading-snug">
          {text}
        </p>
        <div className="flex flex-wrap gap-2">
          <SubmitButton size="sm" className="h-11" variant={danger ? "danger" : "strong"} pendingLabel={pending}>
            {confirm}
          </SubmitButton>
          <button
            type="button"
            className="h-11 px-3.5 text-[13px] font-semibold hover:bg-surface-2"
            onClick={(e) => {
              const details = e.currentTarget.closest("details");
              if (details) details.open = false;
            }}
          >
            Cancelar
          </button>
        </div>
      </InlineActionForm>
    </details>
  );
}
