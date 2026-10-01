"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatus } from "@/components/ui/save-status";
import { ActionErrorText } from "@/components/social/session-expired";
import { cn } from "@/lib/utils/cn";
import { dayNoOfIso, formatBodyNumber, useWeighIn } from "./use-weigh-in";

const LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted";

/**
 * Corpo's weigh-in (W-083): the day (today by default, back-dated up to a
 * year) and the weight, comma decimals welcome. A value far from a recent
 * weigh-in asks "Confere?" first. The same day twice keeps the latest.
 */
export function WeighInForm({
  todayIso,
  minIso,
  last,
  className,
}: {
  /** Today on the São Paulo calendar ("2026-09-28"): the default and the latest day allowed. */
  todayIso: string;
  minIso: string;
  last: { kg: number; day: number } | null;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(todayIso);
  const w = useWeighIn(last);

  return (
    <form
      className={cn("flex flex-col gap-3", className)}
      data-weigh-in-form
      onSubmit={(e) => {
        e.preventDefault();
        w.submit(date === todayIso ? null : date, dayNoOfIso(date));
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-day`} className={LABEL}>
            Dia
          </label>
          <Input
            id={`${id}-day`}
            type="date"
            value={date}
            min={minIso}
            max={todayIso}
            required
            onChange={(e) => setDate(e.target.value || todayIso)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-kg`} className={LABEL}>
            Peso (kg)
          </label>
          <div className="relative">
            <Input
              ref={input}
              id={`${id}-kg`}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={w.text}
              onChange={(e) => w.setText(e.target.value)}
              placeholder={last ? formatBodyNumber(last.kg) : undefined}
              aria-invalid={w.error ? true : undefined}
              className="w-28 pr-9 font-mono tabular-nums"
            />
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              kg
            </span>
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={w.pending}>
          {w.pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      {w.confirm && last ? (
        <div role="alert" className="border-l-2 border-l-accent bg-surface-2 px-3 py-2 text-xs">
          <p>
            Confere? Última pesagem: <span className="font-mono font-semibold">{formatBodyNumber(last.kg)} kg</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={w.confirmSave}>
              Está certo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                w.cancelConfirm();
                input.current?.focus();
              }}
            >
              Corrigir
            </Button>
          </div>
        </div>
      ) : null}
      {w.error ? (
        <p role="alert" className="text-xs text-danger">
          <ActionErrorText error={w.error} />
        </p>
      ) : (
        <SaveStatus pending={w.pending} savedAt={w.savedAt} />
      )}
    </form>
  );
}
