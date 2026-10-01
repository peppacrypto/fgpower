"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { GArrow } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionErrorText } from "@/components/social/session-expired";
import { formatBodyNumber, useWeighIn } from "@/app/app/progress/body/use-weigh-in";
import { cn } from "@/lib/utils/cn";

const MONO = "font-mono text-[11px] font-bold uppercase tracking-[0.14em]";

/**
 * Today's "PESO DE HOJE" (W-083): one field for the day's weigh-in, when the
 * program asks for body data this week (a GD block's first or last week,
 * GD Adaptação's first) or the user has been weighing in (the last 14 days)
 * — and not yet today. Once saved it reads "PESO HOJE 81,4 KG · MÉDIA 7 D
 * 81,9" for the rest of the day in a week that asks for it; any other week
 * the row is gone on the next visit (Today stays calm). Owner-only: "Corpo"
 * is private. Placed after the week/program cards; at most one optional
 * prompt shows on Today (the fatigue card first, then this, then the team
 * invite).
 */
export function WeighInRow({
  show,
  mode,
  glance,
  todayNo,
}: {
  /** Today's decision (the week asks, or the habit is on — and nothing else claims the spot). */
  show: boolean;
  /** "measure"/"weigh": the program asks this week; null: the habit. */
  mode: "measure" | "weigh" | null;
  glance: { todayKg: number | null; lastKg: number | null; lastDay: number | null; avg7: number | null };
  todayNo: number;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const last = glance.lastKg != null && glance.lastDay != null ? { kg: glance.lastKg, day: glance.lastDay } : null;
  const w = useWeighIn(last);
  // A value just saved here stays confirmed until the next visit, whatever the page decides.
  if (!show && w.saved == null) return null;

  const todayKg = w.saved ?? glance.todayKg;
  // One live region, kept in place while the row turns from the field into the saved line
  // (a region inserted together with its text is usually not read out).
  const announce = (
    <p role="status" className="sr-only">
      {w.saved != null ? `Peso de hoje salvo: ${formatBodyNumber(w.saved)} kg.` : ""}
    </p>
  );
  if (todayKg != null) {
    return (
      <>
        {announce}
        <div className="reg-frame mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5" data-weigh-in="saved">
          <p className={cn(MONO, "min-w-0")}>
            <span className="whitespace-nowrap">Peso hoje {formatBodyNumber(todayKg)} kg</span>
            {w.saved == null && glance.avg7 != null ? (
              <span className="whitespace-nowrap text-muted"> · média 7 d {formatBodyNumber(glance.avg7)}</span>
            ) : w.saved != null ? (
              <span className="whitespace-nowrap text-success"> · salvo ✓</span>
            ) : null}
          </p>
          <Link
            href="/app/progress/body"
            className={cn(MONO, "-my-2 inline-flex min-h-11 items-center gap-1 text-accent hover:underline")}
          >
            Corpo
            <GArrow className="size-3" />
          </Link>
        </div>
      </>
    );
  }

  const hint =
    mode === "weigh"
      ? "Pese-se toda manhã: depois do banheiro, antes de comer."
      : mode === "measure"
        ? "Semana de medidas: pese-se de manhã, depois do banheiro, antes de comer."
        : null;
  return (
    <>
      {announce}
      <form
        className="reg-frame mt-3 px-3 py-2.5"
        data-weigh-in="open"
        onSubmit={(e) => {
          e.preventDefault();
          w.submit(null, todayNo);
        }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor={`${id}-kg`} className={cn(MONO, "flex-1 whitespace-nowrap")}>
            Peso de hoje
          </label>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                ref={input}
                id={`${id}-kg`}
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                value={w.text}
                onChange={(e) => w.setText(e.target.value)}
                placeholder={glance.lastKg != null ? formatBodyNumber(glance.lastKg) : undefined}
                aria-invalid={w.error ? true : undefined}
                aria-describedby={hint ? `${id}-hint` : undefined}
                className="w-28 pr-9 font-mono tabular-nums"
              />
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                kg
              </span>
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={w.pending}>
              {w.pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
        {hint ? (
          <p id={`${id}-hint`} className="mt-1.5 text-[11px] text-muted">
            {hint}
          </p>
        ) : null}
        {w.confirm && last ? (
          <div role="alert" className="mt-2 border-l-2 border-l-accent bg-surface-2 px-3 py-2 text-xs">
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
          <p role="alert" className="mt-1.5 text-xs text-danger">
            <ActionErrorText error={w.error} />
          </p>
        ) : null}
      </form>
    </>
  );
}
