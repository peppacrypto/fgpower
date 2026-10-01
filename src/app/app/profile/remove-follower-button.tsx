"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ConfirmSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { removeFollower } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { focusRowPerson } from "./seguidores/person-line";

/**
 * "Remover" on a follower (W-141): asks first, then the row reads "Removido"
 * (and dims) until the next visit — through a status region that is always
 * there, so it is read out; the focus stays on the row's person. The person
 * isn't told. Its parts sit in the row's wrapping button cluster (PersonLine),
 * so an error takes a line of its own under the buttons.
 */
export function RemoveFollowerButton({
  person,
  onRemoved,
}: {
  person: { id: string; username: string | null; name: string };
  /** The row's other buttons go with the follower ("Seguir de volta" no longer applies). */
  onRemoved?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLSpanElement>(null);
  const handle = person.username ? `@${person.username}` : person.name;

  // The button is gone: keep the focus on this row instead of the page.
  useEffect(() => {
    if (removed) focusRowPerson(statusRef.current);
  }, [removed]);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => removeFollower(person.id));
      setConfirming(false);
      if (result.ok) {
        setRemoved(true);
        onRemoved?.();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {removed ? null : (
        <Button variant="outline" size="sm" aria-haspopup="dialog" aria-label={`Remover ${handle} dos seguidores`} onClick={() => setConfirming(true)}>
          Remover
        </Button>
      )}
      <span
        ref={statusRef}
        role="status"
        tabIndex={-1}
        data-removed={removed ? "" : undefined}
        className={removed ? "font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted outline-none" : "sr-only"}
      >
        {removed ? (
          <>
            Removido<span className="sr-only">: {handle}</span>
          </>
        ) : null}
      </span>
      {error ? (
        <p role="alert" className="basis-full text-right text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
      {confirming ? (
        <ConfirmSheet
          title={`Remover ${handle} dos seguidores?`}
          subtitle={`${handle} não é avisado. Com a conta privada, ${handle} vai precisar pedir para seguir de novo.`}
          confirmLabel="Remover"
          danger
          pending={pending}
          pendingLabel="Removendo…"
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
