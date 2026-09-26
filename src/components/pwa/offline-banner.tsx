"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isWorkoutFocusPath } from "./resume";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

/** Browser connectivity (online/offline events), SSR-safe. */
export function useOnline() {
  return useSyncExternalStore(subscribe, getOnline, getServerOnline);
}

/**
 * A slim strip while the device has no connection, so a failed tap reads as
 * "no signal" rather than "the app broke" — and a short all-clear when it
 * comes back. Workout sets typed offline are mirrored to this device
 * (localStorage) and sent later, which is what the copy promises; nothing
 * else claims to queue.
 *
 * It floats over the page (fixed, one line, same height in both states) and
 * never takes layout space: at the gym the signal flaps, and a strip in the
 * page flow shoved the set table's ✓/kg boxes around under the user's finger.
 * Taps go through it to whatever it covers — that's where the user aimed.
 */
export function OfflineBanner() {
  const online = useOnline();
  const pathname = usePathname();
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOnline = () => {
      setBackOnline(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBackOnline(false), 3000);
    };
    const onOffline = () => {
      clearTimeout(timer);
      setBackOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const show = !online || backOnline;
  // The workout screen owns the top edge (sticky header with "Finalizar"), so
  // there the strip sits on the bottom edge instead — under the rest timer
  // while one runs (z-20 < its z-30).
  const atBottom = isWorkoutFocusPath(pathname);
  return (
    <>
      {/* Always mounted (and out of the layout) so the live region exists
          before its text changes and screen readers announce it. */}
      <p role="status" aria-live="polite" className="sr-only" data-offline-announcer>
        {show
          ? online
            ? "Conexão de volta."
            : atBottom
              ? "Sem conexão. As séries do treino ficam salvas neste aparelho."
              : "Sem conexão."
          : ""}
      </p>
      {show ? (
        <div
          aria-hidden
          data-offline-banner={online ? "back" : "offline"}
          className={cn(
            "pointer-events-none fixed inset-x-0 flex h-7 items-center gap-2 overflow-hidden whitespace-nowrap px-4 font-mono text-[11px] sm:left-64 sm:px-6",
            atBottom
              ? "bottom-0 z-20 box-content border-t-2 pb-[env(safe-area-inset-bottom,0px)]"
              : "top-[env(safe-area-inset-top,0px)] z-30 border-b-2",
            online ? "border-success bg-success-soft" : "border-warning bg-warning-soft",
          )}
        >
          <span className={cn("shrink-0 font-bold uppercase tracking-[0.16em]", online ? "text-success" : "text-warning")}>
            {online ? "Conexão de volta" : "Sem conexão"}
          </span>
          {online || !atBottom ? null : (
            <span className="min-w-0 truncate text-foreground/80">Séries ficam salvas no aparelho.</span>
          )}
        </div>
      ) : null}
    </>
  );
}
