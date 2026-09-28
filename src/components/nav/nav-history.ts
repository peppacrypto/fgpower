"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Whether there is a page of this visit behind the current one, so BackLink's
 * router.back() stays in the app. `history.length` and `document.referrer`
 * can't tell (the referrer doesn't change on client navigations, and history
 * includes pages before the app).
 *
 * Where the browser has the Navigation API, its `canGoBack` answers for the
 * current history entry: true only with a same-origin entry behind it, and
 * still right after the system back button, an edge swipe or a reload — a
 * deep link opened from WhatsApp has nothing behind it. Elsewhere, a
 * module-level counter, so it survives the app shell ↔ public shell remount
 * (both render NavHistoryTracker); a full load, a deep link or a push tap
 * starts at 1. The counter can't see the system back button (it counts it
 * as one more page), which is why the Navigation API comes first.
 */
let depth = 0;
let lastPath: string | null = null;

/** Counts a navigation to `pathname` (repeats of the same path don't count). */
export function recordNavigation(pathname: string) {
  if (pathname === lastPath) return;
  lastPath = pathname;
  depth += 1;
}

/** Whether an in-app page is behind this one (router.back() stays in the app). */
export function canGoBack(): boolean {
  const navigation = (globalThis as { navigation?: { canGoBack?: unknown } }).navigation;
  if (typeof navigation?.canGoBack === "boolean") return navigation.canGoBack;
  return depth > 1;
}

/**
 * Before router.back(): the page we land on is counted again by the
 * tracker, so going back takes two off — the depth then matches the page.
 */
export function noteBackNavigation() {
  depth = Math.max(0, depth - 2);
  lastPath = null;
}

/** Tests only. */
export function resetNavHistory() {
  depth = 0;
  lastPath = null;
}

/** Mounted once by each shell (AppShell, PublicShell). */
export function NavHistoryTracker() {
  const pathname = usePathname();
  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);
  return null;
}
