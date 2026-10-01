"use client";

import { useState, useTransition } from "react";
import { keepSwapInProgram } from "@/lib/actions/workouts";
import { describeActionFailure, GENERIC_ACTION_ERROR } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";

const KEEP_FAILED = "Não deu — tente de novo.";

/**
 * "Usar no programa" next to a swap on the summary (W-006): the program day
 * asks for the exercise done in its place from now on. `inProgram`: the
 * server's word that it already does — the summary refreshed after the tap
 * (or opened again later) says so too, so the confirmation never vanishes.
 * The status line is always mounted, so the change is announced. A lost
 * login says so, with "Entrar" back to this summary (L-session-expired-workout).
 */
export function KeepSwapButton({ exerciseLogId, inProgram = false }: { exerciseLogId: string; inProgram?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = inProgram || saved;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <span role="status" className={done ? "font-mono font-bold uppercase tracking-[0.12em] text-success" : "sr-only"}>
        {done ? "No programa ✓" : ""}
      </span>
      {done ? null : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                const r = await keepSwapInProgram(exerciseLogId);
                if (r.ok) setSaved(true);
                else setError(KEEP_FAILED);
              } catch {
                // Offline, or the login is gone (then "Entrar"); anything else is a plain retry.
                const failure = await describeActionFailure();
                setError(failure.error === GENERIC_ACTION_ERROR ? KEEP_FAILED : failure.error);
              }
            })
          }
          className="-my-2 min-h-11 font-semibold text-accent underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Usar no programa"}
        </button>
      )}
      {error && !done ? (
        <span role="alert" className="text-danger">
          <ActionErrorText error={error} />
        </span>
      ) : null}
    </span>
  );
}
