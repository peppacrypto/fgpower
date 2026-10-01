"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { revokeWorkoutShareLink } from "@/lib/actions/activities";
import { workoutSummaryHref } from "@/lib/social/links";

/**
 * What the owner sees on their own /t/<token>: that this is the public view,
 * a way back to the summary, and "Desativar link" (confirmed inline) — after
 * which the page itself says the link is no longer active.
 */
export function OwnerLinkBanner({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);

  function revoke() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => revokeWorkoutShareLink(sessionId));
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="border-l-2 border-l-accent bg-surface-2 px-3.5 py-3 text-sm">
      <p className="font-medium">Assim o seu treino aparece para quem abre o link.</p>
      {confirming ? (
        <div role="group" aria-label="Desativar o link" className="mt-2">
          <p className="text-muted">Desativar o link? Quem abrir o link antigo verá “link desativado”.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" disabled={pending} onClick={revoke}>
              {pending ? "Desativando…" : "Desativar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              // Focus starts on the way out, as in every confirm (ConfirmSheet).
              autoFocus
              onClick={() => {
                setConfirming(false);
                trigger.current?.focus();
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          <button
            ref={trigger}
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-11 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-danger hover:underline"
          >
            Desativar link
          </button>
          <Link
            href={workoutSummaryHref(sessionId)}
            className="inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
          >
            Voltar ao resumo
          </Link>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </div>
  );
}
