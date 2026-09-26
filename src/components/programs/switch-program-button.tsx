"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { cn } from "@/lib/utils/cn";

/** "Cancelar" can't back out of a switch already on its way. */
function CancelButton({ size, onCancel }: { size: "md" | "lg"; onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <Button size={size} variant="ghost" disabled={pending} onClick={onCancel}>
      Cancelar
    </Button>
  );
}

/**
 * Starts a program. With another one running it is a switch, so it says so
 * ("Trocar para este programa") and asks first, naming what ends — one stray
 * tap on the sticky bar used to end the current program silently. With no
 * program running it starts in one tap.
 *
 * The ask is a native <details>: "Trocar para este programa" opens the
 * confirmation even before the page has hydrated (a slow first load), and
 * the confirmation is a real form, so the whole switch works without JS.
 */
export function SwitchProgramButton({
  action,
  label,
  pendingLabel,
  active,
  size = "lg",
}: {
  /** The start server action, bound (kept as the form's own action: works before hydration). */
  action: (formData: FormData) => void | Promise<void>;
  /** One-tap label when nothing is running ("Ativar programa"). */
  label: string;
  pendingLabel: string;
  /** The program running now, if any: "GD 1", "semana 3 de 13". */
  active?: { name: string; progress: string } | null;
  size?: "md" | "lg";
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (!active) {
    return (
      <InlineActionForm action={action} failText="Não foi possível ativar. Tente de novo." errorClassName="mt-1.5">
        <SubmitButton size={size} variant="strong" pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      </InlineActionForm>
    );
  }

  const cancel = () => {
    const details = detailsRef.current;
    if (!details) return;
    details.open = false;
    details.querySelector("summary")?.focus();
  };

  return (
    <details
      ref={detailsRef}
      className="group open:w-full open:basis-full"
      // The summary hides once open: move focus to the confirmation's answer.
      onToggle={(e) => {
        if (e.currentTarget.open) e.currentTarget.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
      }}
    >
      <summary
        className={cn(
          buttonVariants({ size, variant: "strong" }),
          "cursor-pointer list-none select-none group-open:hidden [&::-webkit-details-marker]:hidden",
        )}
      >
        Trocar para este programa
      </summary>
      <InlineActionForm
        action={action}
        failText="Não foi possível trocar. Tente de novo."
        className="flex w-full flex-col gap-2.5"
      >
        <p className="text-sm leading-snug">
          Isso encerra <span className="font-semibold">{active.name}</span> ({active.progress}). Seus treinos salvos
          continuam no histórico.
        </p>
        <div className="flex flex-wrap gap-2">
          <SubmitButton size={size} variant="strong" pendingLabel="Trocando…">
            Trocar
          </SubmitButton>
          <CancelButton size={size} onCancel={cancel} />
        </div>
      </InlineActionForm>
    </details>
  );
}
