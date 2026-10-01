"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";

/**
 * The unread-notifications count, fresh on every screen of the app shell
 * (W-042). The shell's layout isn't re-rendered on client navigations, so a
 * count rendered there alone would go stale: the provider starts from the
 * server's count and re-reads GET /api/notifications/unread when the page
 * changes or the app comes back to the front (at most every 30 s), and at
 * once on the window event "fg:unread" (announceUnread) — e.g. right after
 * the notifications page marked its rows seen. No polling: a failed read
 * keeps the last value. For admins it carries the open-reports count too
 * (the sidebar's "Admin" pip).
 */

const REREAD_AFTER_MS = 30_000;
const UNREAD_EVENT = "fg:unread";

interface UnreadState {
  unread: number;
  /** Open reports waiting for an admin; null for everyone else. */
  openReports: number | null;
}

const UnreadContext = createContext<UnreadState>({ unread: 0, openReports: null });

/** Wraps the app shell; `initial` is the server's count at render. */
export function UnreadProvider({
  initial,
  initialOpenReports = null,
  children,
}: {
  initial: number;
  /** Admins: the open reports at render (null for everyone else). */
  initialOpenReports?: number | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<UnreadState>({ unread: initial, openReports: initialOpenReports });
  // A new server render (a refresh, a revalidated layout) brings a fresher count.
  const [seen, setSeen] = useState({ initial, initialOpenReports });
  if (seen.initial !== initial || seen.initialOpenReports !== initialOpenReports) {
    setSeen({ initial, initialOpenReports });
    setState({ unread: initial, openReports: initialOpenReports });
  }

  const lastRead = useRef(0);
  const inFlight = useRef(false);

  const reread = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastRead.current = Date.now();
    try {
      const res = await fetch("/api/notifications/unread", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const body = (await res.json()) as { unread?: unknown; openReports?: unknown };
      if (typeof body.unread !== "number") return;
      const unread = body.unread;
      const openReports = typeof body.openReports === "number" ? body.openReports : null;
      setState((s) => (s.unread === unread && s.openReports === openReports ? s : { unread, openReports }));
    } catch {
      // Offline or a deploy in between: keep what we have.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    lastRead.current = Date.now();
  }, []);

  // A new page: re-read when the last read is old.
  const pathname = usePathname();
  useEffect(() => {
    if (Date.now() - lastRead.current > REREAD_AFTER_MS) void reread();
  }, [pathname, reread]);

  // Back to the app (a tab switch, a phone unlocked).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRead.current > REREAD_AFTER_MS) void reread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reread]);

  // Told the count changed.
  useEffect(() => {
    const onUnread = (e: Event) => {
      const detail = (e as CustomEvent<{ unread?: unknown }>).detail;
      if (typeof detail?.unread === "number") {
        const unread = detail.unread;
        lastRead.current = Date.now();
        setState((s) => (s.unread === unread ? s : { ...s, unread }));
      } else {
        void reread();
      }
    };
    window.addEventListener(UNREAD_EVENT, onUnread);
    return () => window.removeEventListener(UNREAD_EVENT, onUnread);
  }, [reread]);

  // The installed app's icon badge, where the platform has one.
  useEffect(() => {
    try {
      if (!window.matchMedia?.("(display-mode: standalone)").matches) return;
      const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (state.unread > 0) void nav.setAppBadge?.(state.unread)?.catch(() => {});
      else void nav.clearAppBadge?.()?.catch(() => {});
    } catch {
      // Not supported: nothing to do.
    }
  }, [state.unread]);

  return <UnreadContext.Provider value={state}>{children}</UnreadContext.Provider>;
}

/** The current unread count (0 outside the provider). */
export function useUnread(): number {
  return useContext(UnreadContext).unread;
}

/** Open reports waiting for an admin (null for everyone else, and outside the provider). */
export function useOpenReports(): number | null {
  return useContext(UnreadContext).openReports;
}

/**
 * The square count badge ("9+" above 9); renders nothing at 0. The digits are
 * decoration: a screen reader hears `srText` (", 2 notificações novas" by
 * default) as part of the link or label it sits in; "" when the caller says
 * it elsewhere (after a tab's label, say).
 */
export function UnreadPip({ count, className, srText }: { count: number; className?: string; srText?: string }) {
  if (!(count > 0)) return null;
  return (
    <span
      data-unread-pip={count}
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center bg-accent px-1 font-mono text-[10px] font-bold leading-none tabular-nums text-accent-foreground",
        className,
      )}
    >
      <span aria-hidden>{count > 9 ? "9+" : count}</span>
      {srText === "" ? null : (
        <span className="sr-only">{srText ?? `, ${plural(count, "notificação nova", "notificações novas")}`}</span>
      )}
    </span>
  );
}

/** The pip with the current unread count, for a server-rendered link (the profile's "Notificações"). */
export function UnreadCountPip({ className }: { className?: string }) {
  return <UnreadPip count={useUnread()} className={className} />;
}

/**
 * Tells the provider the count changed: with a number (e.g. what
 * markNotificationsSeen returned) it is applied as is; without one the
 * provider re-reads it.
 */
export function announceUnread(count?: number) {
  window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: count === undefined ? {} : { unread: count } }));
}
