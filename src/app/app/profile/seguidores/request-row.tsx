"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { respondToFollowRequest } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { focusRowPerson } from "./person-line";

/**
 * Aceitar / Recusar on a follow request (the Solicitações list), answering in
 * place like the notifications do: "Solicitação aceita" / "recusada", read out
 * by the status region; the focus stays on the row's person.
 */
export function RequestActions({ requestId, name }: { requestId: string; name: string }) {
  const [status, setStatus] = useState<"PENDING" | "ACCEPTED" | "DECLINED">("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLSpanElement>(null);

  // The buttons are gone: keep the focus on this row instead of the page.
  const answered = status !== "PENDING";
  useEffect(() => {
    if (answered) focusRowPerson(statusRef.current);
  }, [answered]);

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => respondToFollowRequest(requestId, accept));
      if (result.ok) setStatus(result.status);
      else setError(result.error);
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      {status === "PENDING" ? (
        <span className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => respond(true)} aria-label={`Aceitar ${name}`}>
            Aceitar
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(false)} aria-label={`Recusar ${name}`}>
            Recusar
          </Button>
        </span>
      ) : null}
      <span ref={statusRef} role="status" tabIndex={-1} className="outline-none">
        {status === "ACCEPTED" ? <span className="tag tag--status tag--ok">Solicitação aceita</span> : null}
        {status === "DECLINED" ? <span className="tag tag--status tag--info">Solicitação recusada</span> : null}
      </span>
      {error ? (
        <span role="alert" className="max-w-48 text-right text-xs text-danger">
          <ActionErrorText error={error} />
        </span>
      ) : null}
    </span>
  );
}
