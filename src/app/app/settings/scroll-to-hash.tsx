"use client";

import { useEffect } from "react";

/**
 * Lands a link to one of these sections on it: #usuario and #privacidade
 * (Descobrir, /u, Perfil), #lembretes and #rotina (reminders), and
 * ?bloqueado=1#bloqueados (after blocking someone). Next scrolls to a #hash
 * only when its target is in the navigation's first commit — here the loading
 * skeleton's (loading.tsx) — and then drops it, so those links opened
 * Settings at the top. Runs once the sections are in; the re-render after a
 * save doesn't scroll again.
 *
 * Focus goes to the section too when nothing holds it (the tapped link went
 * with the page it was on), as a fragment link's own landing would: a screen
 * reader reads on from there, and the next Tab goes into it.
 *
 * Next re-renders a page in place (no remount) on a same-page search-param
 * navigation: a link from Settings to Settings?x=…#section would need
 * <ScrollToHash key={searchParams} /> so this runs again.
 */
export function ScrollToHash() {
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return; // a malformed %-escape: no section has that name
    }
    const section = id ? document.getElementById(id) : null;
    if (!section) return;
    section.scrollIntoView();
    const from = document.activeElement;
    if (from === null || from === document.body) {
      // A section takes focus only with tabindex="-1" (which keeps it out of the Tab order). A
      // target that takes focus on its own — a field (#username) — keeps its place in that order.
      if (section.tabIndex < 0 && !section.hasAttribute("tabindex")) section.setAttribute("tabindex", "-1");
      section.focus({ preventScroll: true });
    }
  }, []);
  return null;
}
