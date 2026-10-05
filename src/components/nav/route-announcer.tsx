"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/*
 * App-route announcer. Next's own announcer (next-route-announcer) reads
 * document.title / the first <h1> when the router tree changes — which, for an
 * /app route, is while the loading.tsx skeleton is up: no title yet, and the
 * skeleton's <h1>s are aria-hidden bones, so the navigation is silent, and the
 * tree does not change again when the page streams in. This waits for the
 * skeleton to clear, then announces the destination's <h1> through a polite
 * region. When no skeleton showed (a prefetched or public page) it stays
 * quiet and lets Next's announcer do its job, so nothing is said twice.
 */

/** Stop waiting after this long even if a skeleton is still up (a stuck load). */
const MAX_WAIT_MS = 8000;
/** Frames to wait for a skeleton to appear before giving up on a fast navigation. */
const SETTLE_FRAMES = 6;

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const first = useRef(true);

  useEffect(() => {
    // Screen readers announce the first page on their own.
    if (first.current) {
      first.current = false;
      return;
    }
    let sawSkeleton = false;
    let settle = 0;
    const startedAt = Date.now();
    let raf = 0;

    const tick = () => {
      const skeleton = document.querySelector("[data-skeleton]");
      if (skeleton) {
        sawSkeleton = true;
        settle = 0;
      } else if (sawSkeleton) {
        // Skeleton cleared: the real page has committed — announce its title.
        setMessage(pageTitle());
        return;
      } else if (++settle > SETTLE_FRAMES) {
        // No skeleton ever showed: a fast/public navigation. Next handles it.
        return;
      }
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        if (sawSkeleton) setMessage(pageTitle());
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [pathname]);

  return (
    <p role="status" aria-live="polite" className="sr-only" data-route-announcer>
      {message}
    </p>
  );
}

/** The destination's heading (its <main> <h1>), falling back to the tab title. */
function pageTitle(): string {
  const h1 = document.querySelector("main h1");
  const heading = h1?.textContent?.trim();
  if (heading) return heading;
  // document.title is "<page> · FGPOWER" — keep just the page part.
  return document.title.split("·")[0]?.trim() || document.title;
}
