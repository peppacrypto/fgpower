"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAction } from "@/components/social/run-action";
import { countUnsyncedRows, DRAFTS_KEY_PREFIX } from "@/components/workout/local-workout";
import { plural } from "@/lib/utils/format";
import { isSessionExpiredError } from "@/lib/auth/session-expired";
import { signOutAction } from "./actions";

/**
 * "Sair da conta", the one place to sign out: a tap asks first (inline, no
 * dialog), so a slip doesn't drop the user to Google's account picker, and a
 * failed call says so and lets them try again instead of leaving a dead button.
 * Sets typed offline live only on this phone until the workout screen sends
 * them, so the confirm step says so (and links the workout) when there are any.
 */
export function SignOutRow() {
  const [confirming, setConfirming] = useState(false);
  const [unsent, setUnsent] = useState<{ rows: number; sessionId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function signOut() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => signOutAction());
      // Signed out — or the session was already gone elsewhere: that's where they wanted to be.
      if (result.ok || isSessionExpiredError(result.error)) window.location.replace("/login");
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Sair da conta</p>
          <p className="text-xs text-muted">Neste aparelho. Seus treinos continuam salvos na conta.</p>
        </div>
        {!confirming ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setUnsent(unsentOnThisDevice());
              setConfirming(true);
            }}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <div role="group" aria-label="Confirmar saída" className="border-l-2 border-l-foreground/50 bg-surface-2 px-3.5 py-3">
          <p className="text-sm font-medium">Sair desta conta neste aparelho?</p>
          <p className="mt-0.5 text-xs text-muted">Para voltar, é só entrar com o Google de novo.</p>
          {unsent ? (
            <p className="mt-2 border-l-2 border-l-danger pl-2.5 text-xs font-medium text-danger">
              Este aparelho tem {plural(unsent.rows, "série ainda não enviada", "séries ainda não enviadas")} —{" "}
              <Link href={`/app/workout/${unsent.sessionId}`} className="underline underline-offset-2">
                abra o treino
              </Link>{" "}
              com sinal antes de sair.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="strong" size="sm" disabled={pending} onClick={signOut}>
              {pending ? "Saindo…" : error ? "Tentar de novo" : "Sim, sair"}
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
    </div>
  );
}

/** Rows typed on this device that no server has yet, summed over its workouts (and one to open). */
function unsentOnThisDevice(): { rows: number; sessionId: string } | null {
  let rows = 0;
  let sessionId = "";
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(DRAFTS_KEY_PREFIX)) continue;
      const id = key.slice(DRAFTS_KEY_PREFIX.length);
      const n = countUnsyncedRows(id);
      if (n > 0 && !sessionId) sessionId = id;
      rows += n;
    }
  } catch {
    /* storage unavailable — nothing is kept here */
  }
  return rows > 0 ? { rows, sessionId } : null;
}
