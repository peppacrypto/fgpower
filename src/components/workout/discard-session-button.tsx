"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { discardWorkoutSession } from "@/lib/actions/workouts";

/** Two-step "Descartar" for an in-progress workout (no timeout: it waits for an answer). */
export function DiscardSessionButton({ sessionId, setsDone = 0 }: { sessionId: string; setsDone?: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return (
      <Button size="md" variant="ghost" onClick={() => setArmed(true)}>
        Descartar
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">
        {setsDone === 1
          ? "Descartar 1 série registrada? Ela não será salva."
          : setsDone > 1
            ? `Descartar ${setsDone} séries registradas? Elas não serão salvas.`
            : "Descartar este treino? Ele não será salvo."}
      </span>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await discardWorkoutSession(sessionId);
              router.refresh();
            } catch {
              setError("Não foi possível descartar — sem conexão?");
            }
          })
        }
      >
        {pending ? "Descartando…" : "Sim, descartar"}
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => setArmed(false)}>
        Não
      </Button>
      {error ? <p role="alert" className="w-full text-xs text-danger">{error}</p> : null}
    </div>
  );
}
