"use client";

import { useEffect } from "react";

/**
 * After "Carregar mais", Next scrolls to #treino-N — the first card it added
 * — but leaves focus where it was: on <body> when the link went away (the
 * last step), or on the link now far below the new cards. A screen reader
 * loses its place either way. This puts focus on that card (focusable with
 * tabIndex -1), without scrolling again. Render it keyed by the page number
 * (?p=), so it runs once per step: the page re-renders in place, it doesn't
 * remount. Used by the feed and the profile (/u), whose cards carry those ids.
 */
export function FocusLanding() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!/^treino-\d+$/.test(id)) return;
    const card = document.getElementById(id);
    const from = document.activeElement;
    // Only from where "Carregar mais" leaves it: never away from something else the user is on.
    if (card && (from === null || from === document.body || from.hasAttribute("data-load-more"))) {
      card.focus({ preventScroll: true });
    }
  }, []);
  return null;
}
