"use client";

import { useEffect, useRef, useState } from "react";

const EVENT = "fg:body-announce";

interface Announcement {
  text: string;
  /** Also take the focus (what was focused is gone with the server's redraw). */
  focus: boolean;
}

/**
 * Says an outcome on Corpo out loud ("Registro excluído: pesagem de 28 SET.")
 * from the page's one live region, which Corpo renders above everything that
 * redraws: a list whose last entry was deleted is gone with the server's next
 * render — and a live region inside it with it, before it's read.
 */
export function announceBody(text: string, { focus = false }: { focus?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent<Announcement>(EVENT, { detail: { text, focus } }));
}

/** Corpo's live region (and the focus's place when the thing focused is gone). */
export function BodyAnnouncer() {
  const [said, setSaid] = useState<{ text: string; n: number }>({ text: "", n: 0 });
  const region = useRef<HTMLParagraphElement>(null);
  const focusNext = useRef(false);

  useEffect(() => {
    function onAnnounce(event: Event) {
      const { text, focus } = (event as CustomEvent<Announcement>).detail;
      if (focus) focusNext.current = true;
      setSaid((prev) => ({ text, n: prev.n + 1 }));
    }
    window.addEventListener(EVENT, onAnnounce);
    return () => window.removeEventListener(EVENT, onAnnounce);
  }, []);

  // Focused once the words are in, so they're what the screen reader reads there.
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    region.current?.focus({ preventScroll: true });
  }, [said]);

  return (
    <p ref={region} role="status" tabIndex={-1} className="sr-only" data-body-announcer>
      {said.text}
    </p>
  );
}
