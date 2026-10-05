import { plural } from "@/lib/utils/format";

/**
 * Spoken-duration helpers for the rest timer, lifted out of the `"use client"`
 * rest-timer.tsx so the node vitest harness can import the pure speech logic
 * (A-082) without the component's audio/DOM imports.
 */

export function spokenDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const secs = plural(s, "segundo", "segundos");
  if (m === 0) return secs;
  const mins = plural(m, "minuto", "minutos");
  return s === 0 ? mins : `${mins} e ${secs}`;
}

/** The time left for the role="timer" region: read on demand, never auto-spoken. */
export function restTimerSpeech(leftMs: number, paused: boolean) {
  const left = spokenDuration(Math.max(1, Math.ceil(leftMs / 1000)));
  return paused ? `Em pausa, faltam ${left}` : `Faltam ${left}`;
}
