"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  /** Read after the label by screen readers ("segue o tema do sistema"). */
  description?: string;
  /** The whole name for screen readers when the label is terse ("2,5 quilos" for "2,5"). */
  srLabel?: string;
}

/**
 * One choice among a few chips (Settings: Minha academia's "Pesos", "Tema"): a real
 * radio group — arrow keys move and pick, Tab enters on the selected chip —
 * drawn as 44px chips; the picked one wears the green plate and a firmer
 * border (and a heavier label), so it reads without color too.
 */
export function ChipRadioGroup<T extends string | number>({
  label,
  labelId,
  describedBy,
  options,
  value,
  onChange,
  className,
}: {
  /** The group's name for assistive tech when there is no visible label to point at. */
  label?: string;
  labelId?: string;
  describedBy?: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.value === value);

  function move(from: number, delta: number) {
    const to = (from + delta + options.length) % options.length;
    refs.current[to]?.focus();
    onChange(options[to].value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={labelId ? undefined : label}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((o, i) => {
        const on = i === selected;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.srLabel ?? (o.description ? `${o.label}, ${o.description}` : undefined)}
            // Roving tabindex: Tab lands on the picked chip (the first when none is).
            tabIndex={on || (selected === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(
              "flex h-11 min-w-12 items-center justify-center rounded-[var(--radius-md)] border px-3.5 text-sm tabular-nums transition-colors",
              on
                ? "border-accent bg-accent-soft font-semibold text-accent shadow-[inset_0_0_0_1px_var(--accent)]"
                : "border-border bg-surface font-medium text-foreground hover:border-border-strong hover:bg-surface-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
