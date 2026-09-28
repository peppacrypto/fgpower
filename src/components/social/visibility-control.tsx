"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

export type Visibility = "PRIVATE" | "FOLLOWERS" | "PUBLIC";

export const VISIBILITY_OPTIONS: readonly { value: Visibility; label: string }[] = [
  { value: "PRIVATE", label: "Privado" },
  { value: "FOLLOWERS", label: "Seguidores" },
  { value: "PUBLIC", label: "Público" },
];

/**
 * "Quem vê": Privado · Seguidores · Público as one radio group — one tab stop
 * (the checked option); arrows, Home and End move and select. Controlled:
 * the parent decides whether a change saves at once (the activity page) or
 * waits for a button (the summary). Label it with `labelledBy`.
 */
export function VisibilityControl({
  value,
  onChange,
  labelledBy,
  disabled = false,
  className,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
  /** id of the element naming the group ("Quem vê"). */
  labelledBy: string;
  disabled?: boolean;
  className?: string;
}) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onOptionKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const target =
      e.key === "Home" ? 0 : e.key === "End" ? VISIBILITY_OPTIONS.length - 1 : step !== 0 ? index + step : null;
    if (target == null) return;
    e.preventDefault();
    const i = (target + VISIBILITY_OPTIONS.length) % VISIBILITY_OPTIONS.length;
    onChange(VISIBILITY_OPTIONS[i].value);
    optionRefs.current[i]?.focus();
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={cn("flex min-w-0 border border-border", className)}>
      {VISIBILITY_OPTIONS.map((opt, i) => {
        const on = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onOptionKeyDown(e, i)}
            className={cn(
              "min-h-10 min-w-0 flex-1 border-l border-border px-1 text-[13px] transition-colors first:border-l-0",
              on ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-surface-2",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
