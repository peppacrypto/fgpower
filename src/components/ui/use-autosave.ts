"use client";

import { useRef, useState, useTransition } from "react";
import type { SettingsSaveResult } from "@/lib/actions/result";
import { runAction } from "@/components/social/run-action";

/**
 * State for a block of autosaving controls (Settings switches, the
 * post-workout check-in). Every change is applied
 * at once and saved as the whole object; a failed save rolls the switches
 * back to what the server last confirmed and reports the tapped field.
 *
 * Switches stay usable while a save is in flight, so saves can overlap. Each
 * save carries every earlier change too, which is why only the newest one
 * decides what the UI shows: an older failure with a newer save still
 * pending is left for that newer save to settle (it writes the same change),
 * and an older success never overrides a newer confirmed value.
 */
export function useAutosave<T extends object>(initial: T, save: (next: T) => Promise<SettingsSaveResult>) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ field: keyof T; message: string } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // The newest optimistic value, readable before React re-renders.
  const current = useRef(initial);
  // Last value the server confirmed (what a failure rolls back to) and its request id.
  const confirmed = useRef({ value: initial, id: 0 });
  const latestId = useRef(0);

  function update(patch: Partial<T>) {
    const field = Object.keys(patch)[0] as keyof T;
    const next = { ...current.current, ...patch };
    const id = ++latestId.current;
    current.current = next;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => save(next));
      if (result.ok) {
        if (id > confirmed.current.id) confirmed.current = { value: next, id };
        if (id === latestId.current) setSavedAt(result.savedAt);
        return;
      }
      if (id !== latestId.current) return;
      current.current = confirmed.current.value;
      setValue(confirmed.current.value);
      setError({ field, message: `${result.error} A alteração foi desfeita.` });
    });
  }

  const errorFor = (field: keyof T) => (error?.field === field ? error.message : null);

  return { value, pending, savedAt, update, errorFor };
}
