"use client";

import { useEffect, useState } from "react";

/**
 * The dossier's sticky start bar, shown only once the masthead's own buttons
 * have scrolled out of view above — so the first screen never shows the same
 * CTA twice. Hidden until then (and before hydration).
 */
export function StickyActionsBar({ watchId, children }: { watchId: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Out of view *above* the viewport (scrolled past), not below it.
      setShow(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  return (
    <div
      hidden={!show}
      data-testid="dossier-sticky-actions"
      className="sticky bottom-[var(--nav-h)] z-30 mt-10 panel-raised p-3 sm:bottom-4"
    >
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Opens a collapsed <details> section when a link points at it — the jump
 * nav ("Descrição", "Ciência") used to land on a closed accordion — and when
 * the page is opened with its #hash.
 */
export function OpenSectionsOnHash() {
  useEffect(() => {
    const open = (id: string) => {
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement) el.open = true;
    };
    const fromHash = () => open(decodeURIComponent(window.location.hash.slice(1)));
    // Before the browser scrolls to it, so it scrolls to the opened section.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (link) open(decodeURIComponent(link.getAttribute("href")!.slice(1)));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
