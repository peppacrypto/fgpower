"use client";

import { ActionErrorText } from "@/components/social/session-expired";

/**
 * A labelled on/off switch row used by the autosaving Settings blocks. The
 * whole row (at least 44px tall) is the target; the switch is drawn square,
 * Dossiê-style — a ruled track with a square knob that inks accent when on —
 * over a real checkbox (role="switch"), which keeps the keyboard, the checked
 * state and the name for assistive tech.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  error,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Shown under this row when its last save failed (and was rolled back). */
  error?: string | null;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
        {error ? (
          <span role="alert" className="mt-1 block text-xs font-medium text-danger">
            <ActionErrorText error={error} />
          </span>
        ) : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className="h-6 w-11 border border-foreground/50 bg-surface-2 transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1 top-1 size-4 bg-foreground/70 transition-transform duration-150 peer-checked:translate-x-5 peer-checked:bg-accent-foreground"
        />
      </span>
    </label>
  );
}
