"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { runAction } from "@/components/social/run-action";
import { isSessionExpiredError } from "@/lib/auth/session-expired";
import { signOutAction } from "@/app/app/settings/actions";

/**
 * The one way out of onboarding (A-033): a wrong Google account on a shared
 * phone must not have to finish the wizard — and create a discoverable
 * @handle — just to reach "Sair". A tap asks first (inline, no dialog) so a
 * slip doesn't drop the user to /login; confirming signs out on the server and
 * loads /login fresh, like SignOutRow. The sessionStorage draft is keyed per
 * userId, so the next account starts clean.
 */
export function SignOutLink({ firstName }: { firstName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function signOut() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => signOutAction());
      if (result.ok || isSessionExpiredError(result.error)) window.location.replace("/login");
      else setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        <LogOut className="size-3.5" aria-hidden />
        Não é você{firstName ? `, ${firstName}` : ""}? Sair
      </button>
    );
  }
  return (
    <div role="group" aria-label="Confirmar saída" className="border-l-2 border-l-foreground/50 bg-surface-2 px-3.5 py-3 text-left">
      <p className="text-sm font-medium">Sair desta conta neste aparelho?</p>
      <p className="mt-0.5 text-xs text-muted">Para usar outra conta, entre de novo.</p>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={signOut}
          className="inline-flex min-h-9 items-center bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-60"
        >
          {pending ? "Saindo…" : error ? "Tentar de novo" : "Sim, sair"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="inline-flex min-h-9 items-center border border-foreground/40 px-3 text-sm font-semibold disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
