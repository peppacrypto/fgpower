"use client";

import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/components/ui/use-autosave";
import { ActionErrorText } from "@/components/social/session-expired";
import { saveCheckIn } from "@/lib/actions/workouts";
import { checkBodyValue } from "@/lib/training/body-weight";
import { parseDecimalInput } from "@/lib/training/set-plan";
import { formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** The check-in as the card edits it (lib/actions/workouts CheckInInput). */
export interface CheckInValues {
  sessionRpe: number | null;
  soreness: number | null;
  shortSleep: boolean;
  lingeringPain: boolean;
  highStress: boolean;
  bodyweightKg: number | null;
  notes: string | null;
}

const MONO = "font-mono text-[11px] font-bold uppercase tracking-[0.14em]";
const LEGEND = "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted";
const NOTE_MAX = 500;
const SKIP_KEY = (sessionId: string) => `fg:check-in-skip:${sessionId}`;
const SKIP_EVENT = "fg:check-in-skip";

/** The answered parts, in words: "Esforço 8/10 · Dor 3/10 · 81,4 kg · Sono < 6 h · Dor > 72 h · Estresse". */
export function checkInParts(v: CheckInValues): string[] {
  return [
    v.sessionRpe != null ? `Esforço ${v.sessionRpe}/10` : null,
    v.soreness != null ? `Dor ${v.soreness}/10` : null,
    v.bodyweightKg != null ? `${formatNumber(v.bodyweightKg, 1)} kg` : null,
    v.shortSleep ? "Sono < 6 h" : null,
    v.lingeringPain ? "Dor > 72 h" : null,
    v.highStress ? "Estresse" : null,
  ].filter((p): p is string => p !== null);
}

/** An answered check-in in one mono line, with its note below — the collapsed card, and the read-only one after 24 h. */
export function CheckInLine({
  values,
  className,
  action,
}: {
  values: CheckInValues;
  className?: string;
  /** "Editar", while it can still be changed. */
  action?: React.ReactNode;
}) {
  const parts = checkInParts(values);
  return (
    <section aria-label="Check-in do treino" className={cn("reg-frame px-3 py-2", className)} data-check-in="answered">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className={cn(MONO, "min-w-0")}>
          <span className="text-muted">Check-in · </span>
          {/* Each answer stays whole; the line breaks at the separators. */}
          {parts.length > 0
            ? parts.map((p, i) => (
                <Fragment key={p}>
                  {i > 0 ? " · " : null}
                  <span className="whitespace-nowrap">{p}</span>
                </Fragment>
              ))
            : "sem respostas"}
        </p>
        {action}
      </div>
      {/* Spaced by a margin, not padding: a clamped box clips at its padding edge, so padding
          would show the top of the note's third line under the second. */}
      {values.notes ? (
        <p className="mb-1 line-clamp-2 text-xs text-foreground/90 wrap-break-word" data-check-in-note>
          {values.notes}
        </p>
      ) : null}
    </section>
  );
}

function readSkipped(sessionId: string): boolean {
  try {
    return localStorage.getItem(SKIP_KEY(sessionId)) === "1";
  } catch {
    return false;
  }
}

function subscribeSkip(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SKIP_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SKIP_EVENT, onChange);
  };
}

function writeSkipped(sessionId: string, skipped: boolean) {
  try {
    if (skipped) localStorage.setItem(SKIP_KEY(sessionId), "1");
    else localStorage.removeItem(SKIP_KEY(sessionId));
  } catch {
    // Private mode: it just opens again next time.
  }
  window.dispatchEvent(new Event(SKIP_EVENT));
}

/**
 * The post-workout check-in (W-127): "Como foi o treino?" — effort, soreness
 * coming in, sleep, pain, stress, the day's weight and a note, every field
 * optional, each saved as it's answered (radios and chips at once, the
 * weight and the note when the field is left). Only the user sees it; it
 * feeds the fatigue signal and Corpo. "Pular" folds it into one line on this
 * device; answered, it folds into its answers with "Editar".
 */
export function CheckInCard({
  sessionId,
  initial,
  answered,
  weightLabel,
  lastKg,
  className,
}: {
  sessionId: string;
  initial: CheckInValues;
  answered: boolean;
  /** "Peso hoje", or "Peso em 20/09" for a workout dated on an earlier day. */
  weightLabel: string;
  /** The latest weigh-in on or before the workout's day (the weight's placeholder). */
  lastKg: number | null;
  className?: string;
}) {
  const id = useId();
  const { value, pending, savedAt, update, errorFor } = useAutosave(initial, (next: CheckInValues) =>
    saveCheckIn(sessionId, next),
  );
  const skipped = useSyncExternalStore(
    subscribeSkip,
    () => readSkipped(sessionId),
    () => false,
  );
  // Answered on an earlier visit: folded. Opened by "Editar" / "Responder", or answered now: open.
  const [open, setOpen] = useState(!answered);
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const saved = answered || savedAt != null;
  // Focus follows a fold or an unfold (the button pressed is gone): to the folded line's
  // button, or to the open card's title.
  const focusNext = useRef<"folded" | "open" | null>(null);
  const foldedAction = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "folded") foldedAction.current?.focus();
    else if (target === "open") title.current?.focus();
  });
  function fold() {
    focusNext.current = "folded";
    setOpen(false);
  }
  function unfold() {
    focusNext.current = "open";
    setOpen(true);
  }

  if (!open || (skipped && !saved)) {
    if (saved) {
      return (
        <CheckInLine
          values={value}
          className={className}
          action={
            <Button ref={foldedAction} size="sm" variant="ghost" onClick={unfold} className="-mr-2 shrink-0">
              Editar
            </Button>
          }
        />
      );
    }
    return (
      <section aria-label="Check-in do treino" className={cn("reg-frame px-3 py-1", className)} data-check-in="skipped">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <p className={MONO}>Check-in do treino</p>
          <Button
            ref={foldedAction}
            size="sm"
            variant="ghost"
            className="-mr-2 shrink-0 text-accent"
            onClick={() => {
              writeSkipped(sessionId, false);
              unfold();
            }}
          >
            Responder
          </Button>
        </div>
      </section>
    );
  }

  const formatted = (kg: number | null) => (kg == null ? "" : formatNumber(kg, 1));
  function commitWeight() {
    const text = weightDraft;
    setWeightDraft(null);
    if (text === null) return;
    if (text.trim() === "") {
      setWeightError(null);
      if (value.bodyweightKg !== null) update({ bodyweightKg: null });
      return;
    }
    const parsed = parseDecimalInput(text);
    const checked = parsed == null ? null : checkBodyValue("BODYWEIGHT", parsed);
    if (!checked || !checked.ok) {
      setWeightError("Confira o valor: entre 25 e 350 kg.");
      setWeightDraft(text);
      return;
    }
    setWeightError(null);
    if (checked.value !== value.bodyweightKg) update({ bodyweightKg: checked.value });
  }
  function commitNote() {
    const text = noteDraft;
    setNoteDraft(null);
    if (text === null) return;
    const note = text.trim() === "" ? null : text.trim().slice(0, NOTE_MAX);
    if (note !== value.notes) update({ notes: note });
  }

  const radioError = errorFor("sessionRpe") ?? errorFor("soreness");
  const chipError = errorFor("shortSleep") ?? errorFor("lingeringPain") ?? errorFor("highStress");
  const fieldError = weightError ?? errorFor("bodyweightKg");

  return (
    <section aria-labelledby={`${id}-title`} className={cn("reg-frame p-4", className)} data-check-in="open">
      <p className={cn(MONO, "text-accent")}>Check-in · opcional</p>
      <h2 id={`${id}-title`} ref={title} tabIndex={-1} className="mt-1 text-lg font-bold tracking-tight outline-none">
        Como foi o treino?
      </h2>
      <p className="mt-0.5 text-sm text-muted">Leva 10 segundos e ajuda a ver sinais de fadiga. Só você vê.</p>

      <Scale
        name={`${id}-rpe`}
        legend="Esforço do treino"
        hint="de 1 (muito leve) a 10 (máximo)"
        from={1}
        to={10}
        value={value.sessionRpe}
        onChange={(n) => update({ sessionRpe: n })}
        className="mt-4"
        cols="grid-cols-10 max-[359px]:grid-cols-5"
      />
      <Scale
        name={`${id}-soreness`}
        legend="Dor muscular ao chegar"
        hint="dos treinos anteriores · 0 = nenhuma"
        from={0}
        to={10}
        value={value.soreness}
        onChange={(n) => update({ soreness: n })}
        className="mt-4"
        cols="grid-cols-11 max-[359px]:grid-cols-6"
        narrowFillers={1}
      />
      {radioError ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          <ActionErrorText error={radioError} />
        </p>
      ) : null}

      <fieldset className="mt-4">
        <legend className={LEGEND}>Recuperação</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              ["shortSleep", "Dormi menos de 6 h"],
              ["lingeringPain", "Dor articular ou dor que dura mais de 72 h"],
              ["highStress", "Estresse alto ou pouca motivação"],
            ] as const
          ).map(([field, label]) => (
            <button
              key={field}
              type="button"
              aria-pressed={value[field]}
              onClick={() => update({ [field]: !value[field] } as Partial<CheckInValues>)}
              className={cn(
                "min-h-11 rounded-[2px] border px-3 py-1.5 text-left font-mono text-[11px] font-semibold leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                value[field]
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-foreground/40 bg-surface text-foreground hover:border-foreground/70",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {chipError ? (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            <ActionErrorText error={chipError} />
          </p>
        ) : null}
      </fieldset>

      <div className="mt-4">
        <label htmlFor={`${id}-kg`} className={LEGEND}>
          {weightLabel}
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="relative">
            <Input
              id={`${id}-kg`}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={weightDraft ?? formatted(value.bodyweightKg)}
              onFocus={() => setWeightDraft((d) => d ?? formatted(value.bodyweightKg))}
              onChange={(e) => {
                setWeightDraft(e.target.value);
                setWeightError(null);
              }}
              onBlur={commitWeight}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder={lastKg != null ? formatNumber(lastKg, 1) : undefined}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={`${id}-kg-hint`}
              className="w-28 pr-9 font-mono tabular-nums"
            />
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              kg
            </span>
          </div>
          <p id={`${id}-kg-hint`} className="text-xs text-muted">
            vai também para Corpo
          </p>
        </div>
        {fieldError ? (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            <ActionErrorText error={fieldError} />
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-note`} className={LEGEND}>
          Nota
        </label>
        <Textarea
          id={`${id}-note`}
          rows={3}
          maxLength={NOTE_MAX}
          value={noteDraft ?? value.notes ?? ""}
          onFocus={() => setNoteDraft((d) => d ?? value.notes ?? "")}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={commitNote}
          placeholder="Algo para lembrar no próximo treino?"
          className="mt-1.5 min-h-0"
        />
        {errorFor("notes") ? (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            <ActionErrorText error={errorFor("notes")!} />
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" />
        {saved ? (
          <Button size="sm" variant="ghost" onClick={fold} className="-mr-2">
            Pronto
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="-mr-2"
            onClick={() => {
              writeSkipped(sessionId, true);
              fold();
            }}
          >
            Pular
          </Button>
        )}
      </div>
    </section>
  );
}

/** A 1–10 / 0–10 scale of native radios drawn as square segments (arrow keys move along it). */
function Scale({
  name,
  legend,
  hint,
  from,
  to,
  value,
  onChange,
  cols,
  narrowFillers = 0,
  className,
}: {
  name: string;
  legend: string;
  hint: string;
  from: number;
  to: number;
  value: number | null;
  onChange: (n: number) => void;
  cols: string;
  /** Blank cells closing the last row of the narrow (< 360px) grid: 0–10 in six columns leaves one. */
  narrowFillers?: number;
  className?: string;
}) {
  const steps = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <fieldset className={className} aria-describedby={`${name}-hint`}>
      <legend className={LEGEND}>{legend}</legend>
      <div className={cn("mt-1.5 grid gap-px border border-foreground/40 bg-foreground/40", cols)}>
        {steps.map((n) => (
          <label
            key={n}
            className={cn(
              "relative flex min-h-11 cursor-pointer items-center justify-center font-mono text-sm font-semibold tabular-nums transition-colors has-[:focus-visible]:z-10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
              value === n ? "bg-accent text-accent-foreground" : "bg-surface text-foreground hover:bg-surface-2",
            )}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {n}
          </label>
        ))}
        {Array.from({ length: narrowFillers }, (_, i) => (
          <span key={`fill-${i}`} aria-hidden className="hidden bg-surface max-[359px]:block" />
        ))}
      </div>
      <p id={`${name}-hint`} className="mt-1 text-[11px] text-muted">
        {hint}
      </p>
    </fieldset>
  );
}
