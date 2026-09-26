"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLiveWorkoutPath, shouldRefreshOnResume } from "./resume";

/**
 * An installed PWA resumes from memory with the page exactly as it was
 * rendered — Today can still say "Boa noite" and show yesterday's week the
 * next morning. When the app comes back after a long sleep or a São Paulo
 * day change, re-fetch the current route's server data (client state and
 * scroll are kept). Never on the live workout screen.
 */
export function ResumeRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let hiddenAt = Date.now();

    const resume = () => {
      const now = Date.now();
      const stale = shouldRefreshOnResume(hiddenAt, now);
      hiddenAt = now;
      if (!stale || isLiveWorkoutPath(pathRef.current)) return;
      // Offline, the RSC fetch would just fail; the next resume will catch up.
      if (!navigator.onLine) return;
      router.refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else resume();
    };
    // Restored from the back/forward cache: same frozen page, same rule.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) resume();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
