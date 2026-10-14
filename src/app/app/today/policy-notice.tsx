"use client";

import { useState, useTransition } from "react";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { Button } from "@/components/ui/button";
import { acknowledgePolicy } from "@/lib/actions/policy";

/**
 * A-054 — a one-time notice when the Terms/Privacy version the user accepted
 * (Profile.acknowledgedPolicyVersion) trails the current POLICY_VERSION. "Ler"
 * opens /privacy; "Entendi" records the new version (acknowledgePolicy) and the
 * notice stops. Rendered only when `stale` (Today decides on the server), so a
 * fresh account never sees it.
 *
 * [OWNER/LEGAL: the summary of what changed and the heading are placeholders;
 * where consent is the legal basis the "Entendi" must be a genuine re-consent,
 * not a dismissal — confirm with counsel before this ships.]
 */
export function PolicyUpdateNotice({ stale }: { stale: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!stale || hidden) return null;

  function acknowledge() {
    setError(null);
    setHidden(true);
    startTransition(async () => {
      const result = await runAction(() => acknowledgePolicy());
      if (!result.ok) {
        setHidden(false);
        setError(result.error);
      }
    });
  }

  return (
    <section aria-label="Aviso de privacidade" className="mt-6 rounded-[var(--radius-lg)] bg-surface-2 px-4 py-3.5">
      <p className="text-[15px] font-semibold">Atualizamos a política</p>
      <p className="mt-1 text-sm text-foreground/90">
        {/* [OWNER/LEGAL: resumo das mudanças materiais — placeholder.] */}
        Nossa Política de Privacidade e os Termos foram atualizados. Veja o que mudou e confirme que leu.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Ler a política</a>
        </Button>
        <Button size="sm" variant="ghost" onClick={acknowledge} disabled={pending}>
          Entendi
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </section>
  );
}
