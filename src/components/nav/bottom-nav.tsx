"use client";

import { useLayoutEffect, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";
import { isWorkoutFocusPath } from "@/components/pwa/resume";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { UnreadPip, useUnread } from "./unread-provider";

/** The tab that carries the unread-notifications pip (notifications live under Perfil on the phone). */
const INBOX_TAB = "/app/profile";

/** `force` shows the nav even in workout focus mode (a 404 on a stale workout link). */
export function BottomNav({ force = false }: { force?: boolean }) {
  const pathname = usePathname();
  // The tab whose navigation is under way: it lights at once and the current
  // one lets go, instead of the old tab staying lit until the new page loads.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const unread = useUnread();

  // Focus mode: hide the nav during a live workout so a mistap can't drop the
  // user out mid-session (the post-workout summary keeps the nav).
  if (!force && isWorkoutFocusPath(pathname)) return null;

  return (
    // Height is pinned to --nav-h (globals.css) — bar + home-indicator inset —
    // so sticky bars and the app <main> can clear it exactly.
    // data-bottom-nav: iOS's install banner sits just above it (globals.css).
    <nav
      aria-label="Navegação principal"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 h-[var(--nav-h)] border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex h-full items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.activePaths?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false);
          return (
            <li key={item.href} className="flex-1">
              {/* aria-current stays on the page actually shown until the new one commits. */}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex h-full touch-manipulation select-none"
              >
                <TabFace
                  item={item}
                  lit={pendingHref ? pendingHref === item.href : active}
                  onPending={setPendingHref}
                  badge={item.href === INBOX_TAB ? unread : 0}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * A tab's icon and label; lit, the icon sits on a soft green pill. Lives inside the <Link> so it can read
 * the link's pending state (useLinkStatus): the tapped tab lights the moment
 * the navigation starts, before the next page has answered.
 */
function TabFace({
  item,
  lit,
  onPending,
  badge = 0,
}: {
  item: NavItem;
  lit: boolean;
  onPending: (update: (current: string | null) => string | null) => void;
  /** Unread notifications: a pip on the icon's corner (and ", N notificações novas" in the tab's name). */
  badge?: number;
}) {
  const { pending } = useLinkStatus();
  // Tell the bar before paint, so the old tab dims in the same frame.
  useLayoutEffect(() => {
    if (!pending) return;
    onPending(() => item.href);
    return () => onPending((current) => (current === item.href ? null : current));
  }, [pending, item.href, onPending]);

  const on = pending || lit;
  const Icon = item.icon;
  return (
    <span
      data-pending={pending ? "true" : undefined}
      data-lit={on ? "true" : undefined}
      className={cn(
        // Lit is more than a hue: the pill behind the icon and a bolder label
        // carry it for colour-blind eyes and in glare.
        "relative flex w-full flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-100",
        on ? "font-semibold text-accent" : "font-medium text-muted",
      )}
    >
      <span
        className={cn(
          "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-100",
          on ? "bg-accent-soft" : "group-active:bg-[var(--ink-3)]",
        )}
      >
        <Icon className="size-5" strokeWidth={on ? 2.1 : 1.75} />
        <UnreadPip count={badge} srText="" className="absolute -right-1 -top-1" />
      </span>
      {item.label}
      {badge > 0 ? <span className="sr-only">, {plural(badge, "notificação nova", "notificações novas")}</span> : null}
    </span>
  );
}

/**
 * For not-found under /app: a stale workout link 404s at a focus-mode path,
 * where the layout's nav hides itself — put it back so the user isn't left
 * without one. Elsewhere the layout's nav is already there (never two).
 */
export function NotFoundBottomNav() {
  const pathname = usePathname();
  return isWorkoutFocusPath(pathname) ? <BottomNav force /> : null;
}
