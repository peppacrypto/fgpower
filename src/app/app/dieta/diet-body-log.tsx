"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { GArrow } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatus } from "@/components/ui/save-status";
import { SectionHead } from "@/components/ui/section-head";
import { ActionErrorText } from "@/components/social/session-expired";
import { runAction } from "@/components/social/run-action";
import { saveBodyMetrics } from "@/lib/actions/body-metrics";
import { bodyKind, checkBodyValue, formatBodyDelta, type WeekOverWeek } from "@/lib/training/body-weight";
import { parseDecimalInput } from "@/lib/training/set-plan";
import { formatBodyNumber, useWeighIn } from "@/app/app/progress/body/use-weigh-in";

const NBSP = " ";
/** How to measure it the same way every time (Corpo's own words). */
const WAIST_HINT = bodyKind("WAIST")?.hint ?? null;

interface DayValue {
  /** Logged that day. */
  value: number | null;
  /** The latest on or before that day. */
  last: { value: number; day: number } | null;
}

/**
 * Dieta's body log: the day's weight and waist, one field each, saved through
 * Corpo's own action (lib/actions/body-metrics: one value per kind and São
 * Paulo day, the latest wins — a weigh-in far off the last asks "Confere?"
 * first, as on Corpo), then this week's average weight against last week's and
 * the way to everything else on Progresso › Corpo. Saving re-renders the page
 * with the new numbers.
 */
export function DietBodyLog({
  date,
  dayNo,
  isToday,
  dayText,
  weight,
  waist,
  week,
  goal,
}: {
  /** The day shown, "2026-11-13". */
  date: string;
  dayNo: number;
  isToday: boolean;
  /** "quinta, 13 nov": the day a value saved here goes to. */
  dayText: string;
  weight: DayValue;
  waist: DayValue;
  week: WeekOverWeek;
  /** The plan's aim, in words. */
  goal?: string;
}) {
  return (
    <section className="mt-10" aria-labelledby="dieta-corpo" data-diet-body>
      <SectionHead id="dieta-corpo" label="Peso e cintura" />
      <p className="mt-1 text-[13px] text-muted">
        {isToday ? "De manhã, em jejum, depois do banheiro." : `Os valores vão para ${dayText}.`}
      </p>
      <div className="card mt-3 divide-y divide-border px-4">
        <WeightRow date={date} dayNo={dayNo} isToday={isToday} value={weight} />
        <WaistRow date={date} isToday={isToday} value={waist} />
      </div>
      <WeekLine week={week} />
      {goal ? <p className="mt-1.5 text-[13px] text-muted">Meta do plano: {goal}</p> : null}
      <Link
        href="/app/progress/body"
        className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        Outras medidas e o histórico em Progresso › Corpo
        <GArrow className="size-3" />
      </Link>
    </section>
  );
}

/** "Hoje: 81,4 kg" / "Neste dia: 84 cm" / "Ainda não registrado". */
function currentText(value: number | null, unit: "kg" | "cm", isToday: boolean) {
  if (value == null) return "Ainda não registrado";
  return `${isToday ? "Hoje" : "Neste dia"}: ${formatBodyNumber(value)}${NBSP}${unit}`;
}

function WeightRow({ date, dayNo, isToday, value }: { date: string; dayNo: number; isToday: boolean; value: DayValue }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const last = value.last ? { kg: value.last.value, day: value.last.day } : null;
  const w = useWeighIn(last);
  return (
    <form
      className="py-3"
      data-diet-weight
      onSubmit={(e) => {
        e.preventDefault();
        w.submit(isToday ? null : date, dayNo);
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={`${id}-kg`} className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Peso</span>
          <span className="block text-[13px] tabular-nums text-muted" data-diet-current>
            {currentText(value.value, "kg", isToday)}
          </span>
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
              placeholder={last ? formatBodyNumber(last.kg) : undefined}
              aria-invalid={w.error ? true : undefined}
              className="w-24 pr-9 tabular-nums"
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
      {w.confirm && last ? (
        <div role="alert" className="mt-3 rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5 text-sm">
          <p>
            Confere? Última pesagem: <span className="font-semibold tabular-nums">{formatBodyNumber(last.kg)} kg</span>
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
        <p role="alert" className="mt-1.5 text-sm text-danger">
          <ActionErrorText error={w.error} />
        </p>
      ) : (
        <SaveStatus className="mt-1" pending={w.pending} savedAt={w.savedAt} />
      )}
    </form>
  );
}

function WaistRow({ date, isToday, value }: { date: string; isToday: boolean; value: DayValue }) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSavedAt(null);
    const parsed = parseDecimalInput(text);
    if (parsed == null) {
      setError(text.trim() === "" ? "Digite a cintura." : "Use só números, como 84,5.");
      return;
    }
    const checked = checkBodyValue("WAIST", parsed);
    if (!checked.ok) {
      setError(`${checked.error}.`);
      return;
    }
    startTransition(async () => {
      const result = await runAction(() => saveBodyMetrics({ date: isToday ? null : date, entries: [{ kind: "WAIST", value: checked.value }] }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText("");
      setSavedAt(result.savedAt);
    });
  }

  return (
    <form
      className="py-3"
      data-diet-waist
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={`${id}-cm`} className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Cintura</span>
          <span className="block text-[13px] tabular-nums text-muted" data-diet-current>
            {currentText(value.value, "cm", isToday)}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              id={`${id}-cm`}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              placeholder={value.last ? formatBodyNumber(value.last.value) : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-hint`}
              className="w-24 pr-9 tabular-nums"
            />
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              cm
            </span>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-1 text-[13px] text-muted">
        {WAIST_HINT}
      </p>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : (
        <SaveStatus className="mt-1" pending={pending} savedAt={savedAt} />
      )}
    </form>
  );
}

/** "Média de 7 dias: 81,9 kg · −0,4 kg em relação aos 7 dias anteriores" (or what's missing for it). */
function WeekLine({ week }: { week: WeekOverWeek }) {
  if (week.avg == null) {
    return (
      <p className="mt-3 text-sm text-muted" data-diet-week>
        A média de 7 dias aparece com 3 pesagens na semana
        {week.count > 0 ? ` (${week.count} de 3 até aqui)` : ""}.
      </p>
    );
  }
  return (
    <p className="mt-3 text-sm" data-diet-week>
      Média de 7 dias:{" "}
      <span className="font-semibold tabular-nums">
        {formatBodyNumber(week.avg)}
        {NBSP}kg
      </span>
      {week.change != null ? (
        <span className="text-muted">
          {" "}
          · <span className="tabular-nums">{formatBodyDelta(week.change, "kg")}</span> em relação aos 7 dias anteriores
        </span>
      ) : (
        <span className="text-muted"> · os 7 dias anteriores ainda não têm média</span>
      )}
    </p>
  );
}
