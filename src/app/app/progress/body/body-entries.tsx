"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionErrorText } from "@/components/social/session-expired";
import { runAction } from "@/components/social/run-action";
import { deleteBodyMetric } from "@/lib/actions/body-metrics";
import { cn } from "@/lib/utils/cn";
import { announceBody } from "./body-announcer";

export interface BodyEntryRow {
  id: string;
  /** "28 SET". */
  date: string;
  /** "81,4 kg". */
  value: string;
  /** Written by a workout's check-in. */
  fromWorkout: boolean;
}

/**
 * A list of weigh-ins or of one measurement's entries, newest first, each
 * with its own delete ("Excluir?" Sim / Não inline — no sheet for one tap
 * on one number). A deleted row goes at once (said out loud once the server
 * confirms, from Corpo's live region: BodyAnnouncer) and comes back if the
 * delete fails. The focus stays in the list — or, when its last entry goes
 * (the list goes with the server's redraw), moves to that live region.
 */
export function BodyEntries({ entries, noun, className }: { entries: BodyEntryRow[]; noun: string; className?: string }) {
  const [asking, setAsking] = useState<string | null>(null);
  /** The row whose "Excluir?" was answered "Não": its × takes the focus back. */
  const [kept, setKept] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const list = useRef<HTMLUListElement>(null);
  const shown = entries.filter((e) => !gone.has(e.id));

  function remove(entry: BodyEntryRow) {
    const { id } = entry;
    const last = shown.length === 1;
    setAsking(null);
    setError(null);
    setGone((prev) => new Set(prev).add(id));
    // The list keeps the focus (the row and its buttons are gone).
    list.current?.focus();
    startTransition(async () => {
      const result = await runAction(() => deleteBodyMetric(id));
      if (!result.ok) {
        setGone((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setError(result.error);
        return;
      }
      // "Registro" carries the agreement: the nouns vary in gender ("pesagem", "cintura", "braço").
      announceBody(`Registro excluído: ${noun} de ${entry.date}.`, { focus: last });
    });
  }

  return (
    <div className={className}>
      <ul ref={list} tabIndex={-1} className="flex flex-col divide-y divide-border border-y border-border outline-none">
        {shown.map((e) => (
          <li key={e.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1" data-body-entry>
            <span className="w-14 shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{e.date}</span>
            <span className="font-mono text-sm font-semibold tabular-nums">{e.value}</span>
            {e.fromWorkout ? <span className="tag tag--mark">treino</span> : null}
            <span className="flex-1" />
            {asking === e.id ? (
              <span className="flex items-center gap-1" role="group" aria-label={`Excluir ${noun} de ${e.date}?`}>
                <span className="text-xs font-semibold">Excluir?</span>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(e)}>
                  Sim
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAsking(null);
                    setKept(e.id);
                  }}
                  autoFocus
                >
                  Não
                </Button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Excluir ${noun} de ${e.date}`}
                onClick={() => {
                  setKept(null);
                  setAsking(e.id);
                }}
                // Back from "Não": the × of the same row, not the top of the page.
                autoFocus={kept === e.id}
                className={cn("-mr-2 flex size-11 items-center justify-center text-muted hover:text-foreground")}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </div>
  );
}
