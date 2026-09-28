"use client";

import { useState, useTransition } from "react";
import { keepSwapInProgram } from "@/lib/actions/workouts";

/**
 * "Usar no programa" next to a swap on the summary (W-006): the program day
 * asks for the exercise done in its place from now on. `inProgram`: the
 * server's word that it already does — the summary refreshed after the tap
 * (or opened again later) says so too, so the confirmation never vanishes.
 * The status line is always mounted, so the change is announced.
 */
export function KeepSwapButton({ exerciseLogId, inProgram = false }: { exerciseLogId: string; inProgram?: boolean }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  const done = inProgram || state === "done";
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
              try {
                const r = await keepSwapInProgram(exerciseLogId);
                setState(r.ok ? "done" : "failed");
              } catch {
                setState("failed");
              }
            })
          }
          className="-my-2 min-h-11 font-semibold text-accent underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Usar no programa"}
        </button>
      )}
      {state === "failed" && !done ? (
        <span role="alert" className="text-danger">
          Não deu — tente de novo.
        </span>
      ) : null}
    </span>
  );
}
