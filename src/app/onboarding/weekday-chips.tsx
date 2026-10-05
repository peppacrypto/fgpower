"use client";

import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * The seven preferred-day toggles (0 = Sunday … 6 = Saturday) in one row of
 * seven equal columns, so "Sáb" never wraps alone on a 390px phone. Shared by
 * onboarding and Settings → Rotina.
 */
/** Monday → Sunday order (as the week strips run), each cell keeping its 0=Sunday weekday value. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function WeekdayChips({ value, onToggle }: { value: number[]; onToggle: (day: number) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAY_ORDER.map((i) => {
        const on = value.includes(i);
        return (
          <button
            type="button"
            key={i}
            onClick={() => onToggle(i)}
            aria-pressed={on}
            className={cn(
              "h-11 min-w-0 rounded-[3px] border text-[13px] font-semibold transition-colors",
              on ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2",
            )}
          >
            {WEEKDAYS[i]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Reconciles "N× por semana" with the days ticked: says when they agree, and
 * when they don't, offers the one-tap fix instead of silently keeping both.
 * The live region is always mounted (empty with no day ticked), so the first
 * message is announced too — regions inserted already filled usually aren't.
 */
export function DaysMatchNote({
  daysPerWeek,
  preferredCount,
  onUseCount,
}: {
  daysPerWeek: number;
  preferredCount: number;
  /** Omitted when the frequency is read-only (it follows the active program, A-025): no one-tap fix. */
  onUseCount?: () => void;
}) {
  const days = plural(preferredCount, "dia marcado", "dias marcados");
  const matches = preferredCount === daysPerWeek;
  return (
    <div aria-live="polite" className={cn(preferredCount > 0 && "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1")}>
      {preferredCount > 0 ? (
        <>
          <span className={cn("tag tag--status", matches ? "tag--ok" : "tag--warn")}>
            {daysPerWeek}x por semana · {days}
          </span>
          {matches || !onUseCount ? null : (
            <button
              type="button"
              onClick={onUseCount}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent underline decoration-2 underline-offset-[3px]"
            >
              Usar {preferredCount}x por semana
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
