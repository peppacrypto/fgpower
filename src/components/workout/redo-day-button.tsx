"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";

/**
 * "Refazer" for a day already trained this week. Asks first — one stray tap
 * next to "Ver" used to open a blank copy of the day, which looks exactly like
 * the saved workout having been lost.
 */
export function RedoDayButton({ dayId }: { dayId: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button variant="ghost" className="px-3" onClick={() => setArmed(true)}>
        Refazer
      </Button>
    );
  }
  return (
    <form
      action={startAdHocWorkoutSession.bind(null, dayId)}
      className="flex w-full basis-full flex-wrap items-center justify-end gap-2"
    >
      <p className="w-full text-right text-xs text-muted">Treinar este dia de novo? O treino salvo continua salvo.</p>
      <SubmitButton pendingLabel="Abrindo…" className="px-3.5">
        Sim, treinar de novo
      </SubmitButton>
      <Button variant="ghost" className="px-3.5" onClick={() => setArmed(false)}>
        Não
      </Button>
    </form>
  );
}
