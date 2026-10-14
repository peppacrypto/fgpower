"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAction } from "@/components/social/run-action";
import { isSessionExpiredError, loginAgainHref } from "@/lib/auth/session-expired";
import { signOutOtherDevicesAction } from "./actions";

/** Where "Entrar" comes back to when this device's own login turns out to be gone. */
const SETTINGS_HREF = "/app/settings#dados-e-conta";

/**
 * "Sair dos outros aparelhos" (Configurações → Dados e conta, A-044): ends the
 * session on every other device the account is signed in on — a lost phone, a
 * shared computer — while this one stays signed in (better-auth's
 * revokeOtherSessions keeps the current token, so no re-login and no page swap).
 * A tap asks first, inline (no dialog), so a slip doesn't drop someone's other
 * sessions, and a failed call says so and lets them try again instead of leaving
 * a dead button. When this device's own login turns out to be gone, it says so
 * with "Entrar" (back to this panel) rather than a retry that can't succeed.
 */
export function SignOutOthersRow() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function signOutOthers() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => signOutOtherDevicesAction());
      if (result.ok) {
        setConfirming(false);
        setDone(true);
      } else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Sair dos outros aparelhos</p>
          <p className="text-xs text-muted">Encerra sua sessão em todos os outros aparelhos. Este continua conectado.</p>
        </div>
        {!confirming && !done ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
          >
            <MonitorSmartphone className="size-4" />
            Sair dos outros
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <div
          role="group"
          aria-label="Confirmar saída dos outros aparelhos"
          className="rounded-[var(--radius-md)] bg-surface-2 px-4 py-3.5"
        >
          <p className="text-sm font-medium">Sair de todos os outros aparelhos?</p>
          <p className="mt-0.5 text-xs text-muted">
            Quem estiver usando sua conta em outro aparelho precisará entrar de novo. Este aparelho continua conectado.
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {error}
              {isSessionExpiredError(error) ? (
                <>
                  {" "}
                  <Link href={loginAgainHref(SETTINGS_HREF)} className="font-semibold underline underline-offset-2">
                    Entrar
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="strong" size="sm" disabled={pending} onClick={signOutOthers}>
              {pending ? "Saindo…" : error ? "Tentar de novo" : "Sim, desconectar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      {done ? (
        <p
          role="status"
          className="rounded-[var(--radius-md)] bg-success-soft px-4 py-3 text-sm font-medium text-foreground"
        >
          Pronto — os outros aparelhos foram desconectados.
        </p>
      ) : null}
    </div>
  );
}
