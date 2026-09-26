"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { discardWorkoutSession } from "@/lib/actions/workouts";
import { actionFailText } from "./inline-action-form";
import { forgetLocalWorkout } from "./local-workout";

/**
 * Two-step "Descartar" for an in-progress workout (no timeout: it waits for an
 * answer). A discard lands on Today with a one-time "Treino descartado." note.
 */
export function DiscardSessionButton({
  sessionId,
  setsDone = 0,
  size = "md",
}: {
  sessionId: string;
  setsDone?: number;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return (
      <Button size={size} variant="ghost" onClick={() => setArmed(true)}>
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
        size={size}
        variant="danger"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const res = await discardWorkoutSession(sessionId);
              // Not ok = it was already closed elsewhere: just show the fresh state.
              if (res.ok) {
                // Nothing of a discarded workout (offline drafts, rest timer) should linger here.
                forgetLocalWorkout(sessionId);
                router.replace("/app/today?descartado=1");
              } else router.refresh();
            } catch {
              setError(actionFailText("Não foi possível descartar. Tente de novo."));
            }
          })
        }
      >
        {pending ? "Descartando…" : "Sim, descartar"}
      </Button>
      <Button size={size} variant="ghost" disabled={pending} onClick={() => setArmed(false)}>
        Não
      </Button>
      {error ? <p role="alert" className="w-full text-xs text-danger">{error}</p> : null}
    </div>
  );
}
