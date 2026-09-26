"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DiscardSessionButton } from "@/components/workout/discard-session-button";
import { actionFailText } from "@/components/workout/inline-action-form";
import { countUnsyncedRows, forgetLocalWorkout } from "@/components/workout/local-workout";
import { finishStaleWorkoutSession } from "@/lib/actions/workouts";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * A workout left open on an earlier day (or many hours ago). It no longer
 * takes over Today — the plan and the day list stay usable — and it can be
 * closed as it really happened: saved on the day it was trained, with the
 * time actually spent between sets, instead of "finishing" it now with a
 * 100-hour duration counted in this week.
 *
 * Sets typed or ✓'d offline that never reached the server live only in this
 * device's draft mirror. Saving from here would close the session without
 * them, so while there are any the save goes through the workout screen,
 * which sends them first (and offers the same "Salvar como feito em …").
 */
export function StaleSessionRow({
  sessionId,
  name,
  setsDone,
  onServer,
  dayLabel,
}: {
  sessionId: string;
  name: string;
  setsDone: number;
  /** Anything of it is saved on the server; without it the row shows only for offline sets on this device. */
  onServer: boolean;
  /** "21/09": the São Paulo day it will be saved on. */
  dayLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Read after hydration (0 on the server): the mirror is per device.
  const unsynced = useSyncExternalStore(subscribeStorage, () => countUnsyncedRows(sessionId), () => 0);

  if (!onServer && unsynced === 0) return null;
  const workoutHref = `/app/workout/${sessionId}`;

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      // Typed offline in another tab since this rendered: send them from the workout first.
      if (countUnsyncedRows(sessionId) > 0) {
        router.push(workoutHref);
        return;
      }
      try {
        const res = await finishStaleWorkoutSession(sessionId);
        if (res.ok) {
          forgetLocalWorkout(sessionId);
          router.replace(`/app/today?salvo=${sessionId}`);
        } else if (res.reason === "EMPTY") {
          setMessage("Nenhuma série completa para salvar. Continue o treino ou descarte.");
        } else {
          // Closed meanwhile (another tab or device): show the fresh state.
          router.refresh();
        }
      } catch (err) {
        unstable_rethrow(err);
        setMessage(actionFailText("Não foi possível salvar. Tente de novo."));
      }
    });

  return (
    <div data-testid="stale-session" className="border-l-2 border-l-warning bg-warning-soft px-3 py-2.5">
      <p className="text-sm font-semibold leading-snug">
        Treino de {dayLabel} não finalizado
        {setsDone > 0 ? ` · ${setsDone === 1 ? "1 série" : `${setsDone} séries`}` : ""}
      </p>
      <p className="mt-0.5 truncate font-mono text-[11px] text-muted">{name}</p>
      {unsynced > 0 ? (
        <p className="mt-1.5 text-xs leading-snug">
          {unsynced === 1
            ? "1 série ficou só neste aparelho. Abra o treino para enviá-la antes de salvar."
            : `${unsynced} séries ficaram só neste aparelho. Abra o treino para enviá-las antes de salvar.`}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {unsynced > 0 ? (
          <Button size="sm" asChild>
            <Link href={workoutHref}>Revisar e salvar</Link>
          </Button>
        ) : setsDone > 0 ? (
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Salvando…" : `Salvar como feito em ${dayLabel}`}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" asChild>
          <Link href={workoutHref}>Continuar hoje</Link>
        </Button>
        <DiscardSessionButton sessionId={sessionId} setsDone={setsDone} size="sm" />
      </div>
      {message ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
