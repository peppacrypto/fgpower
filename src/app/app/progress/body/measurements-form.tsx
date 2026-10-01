"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatus } from "@/components/ui/save-status";
import { ActionErrorText } from "@/components/social/session-expired";
import { runAction } from "@/components/social/run-action";
import { saveBodyMetrics } from "@/lib/actions/body-metrics";
import { MEASUREMENT_KINDS, checkBodyValue } from "@/lib/training/body-weight";
import { parseDecimalInput } from "@/lib/training/set-plan";

const LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted";

/**
 * Corpo's measurements (W-083): the day and any of the six circumferences —
 * each optional, each with how to measure it the same way every time. Blank
 * fields aren't sent (saving never deletes); the same kind on the same day
 * keeps the latest.
 */
export function MeasurementsForm({ todayIso, minIso }: { todayIso: string; minIso: string }) {
  const id = useId();
  const [date, setDate] = useState(todayIso);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setFormError(null);
    setSavedAt(null);
    const next: Record<string, string> = {};
    const entries: { kind: string; value: number }[] = [];
    for (const k of MEASUREMENT_KINDS) {
      const text = values[k.kind]?.trim() ?? "";
      if (text === "") continue;
      const parsed = parseDecimalInput(text);
      const checked = parsed == null ? null : checkBodyValue(k.kind, parsed);
      if (!checked || !checked.ok) {
        next[k.kind] = `Confira o valor: entre ${k.min} e ${k.max} cm.`;
        continue;
      }
      entries.push({ kind: k.kind, value: checked.value });
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (entries.length === 0) {
      setFormError("Preencha ao menos uma medida.");
      return;
    }
    startTransition(async () => {
      const result = await runAction(() => saveBodyMetrics({ date: date === todayIso ? null : date, entries }));
      if (!result.ok) {
        const field = "field" in result ? result.field : undefined;
        if (field && MEASUREMENT_KINDS.some((k) => k.kind === field)) setErrors({ [field]: result.error });
        else setFormError(result.error);
        return;
      }
      setValues({});
      setSavedAt(result.savedAt);
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      data-measurements-form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
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
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 min-[480px]:grid-cols-2">
        {MEASUREMENT_KINDS.map((k) => {
          const error = errors[k.kind];
          return (
            <div key={k.kind} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${id}-${k.kind}`} className="text-sm font-semibold">
                {k.label} <span className="font-normal text-muted">(cm)</span>
              </label>
              <p id={`${id}-${k.kind}-hint`} className="text-[11px] leading-snug text-muted">
                {k.hint}
              </p>
              <div className="relative mt-0.5">
                <Input
                  id={`${id}-${k.kind}`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={values[k.kind] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setValues((prev) => ({ ...prev, [k.kind]: v }));
                    setErrors((prev) => {
                      const rest = { ...prev };
                      delete rest[k.kind];
                      return rest;
                    });
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${id}-${k.kind}-hint${error ? ` ${id}-${k.kind}-error` : ""}`}
                  className="w-28 pr-10 font-mono tabular-nums"
                />
                <span aria-hidden className="pointer-events-none absolute left-[5.25rem] top-1/2 -translate-y-1/2 text-sm text-muted">
                  cm
                </span>
              </div>
              {error ? (
                <p id={`${id}-${k.kind}-error`} role="alert" className="text-xs text-danger">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Salvando…" : "Salvar medidas"}
        </Button>
        {formError ? (
          <p role="alert" className="text-xs text-danger">
            <ActionErrorText error={formError} />
          </p>
        ) : (
          <SaveStatus pending={pending} savedAt={savedAt} />
        )}
      </div>
    </form>
  );
}
