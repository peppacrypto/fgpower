"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { WEEK_REVIEW_COOKIE, WEEK_REVIEW_STORAGE_KEY } from "./week-start";

const CHANGE_EVENT = "fg:week-review-change";

function readClosed(): string | null {
  try {
    return localStorage.getItem(WEEK_REVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Monday's "Semana anterior" frame with its close button (W-129). Closed, it
 * stays closed for that week on this device: localStorage, mirrored to a
 * cookie so the next render leaves it out on the server.
 */
export function WeekReviewFrame({
  weekKey,
  label,
  children,
}: {
  /** The week being closed out (its Monday's day number). */
  weekKey: string;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  const closed = useSyncExternalStore(subscribe, readClosed, () => null);
  if (closed === weekKey) return null;

  function close() {
    try {
      localStorage.setItem(WEEK_REVIEW_STORAGE_KEY, weekKey);
    } catch {
      // Private mode: the cookie still keeps it closed.
    }
    document.cookie = `${WEEK_REVIEW_COOKIE}=${weekKey}; path=/app; max-age=${9 * 24 * 60 * 60}; samesite=lax`;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <section aria-label="Semana anterior" data-week-review className="reg-frame p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{label}</div>
        <button
          type="button"
          onClick={close}
          aria-label="Fechar resumo da semana anterior"
          className="-mr-3 -mt-3 flex size-11 shrink-0 items-center justify-center text-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </section>
  );
}
