"use client";

import { ActionErrorText } from "@/components/social/session-expired";

/** A labelled on/off switch row used by the autosaving Settings blocks. */
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
    <label className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
        {error ? (
          <span role="alert" className="mt-1 block text-xs font-medium text-danger">
            <ActionErrorText error={error} />
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-accent"
      />
    </label>
  );
}
