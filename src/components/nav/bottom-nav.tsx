"use client";

import { useLayoutEffect, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isWorkoutFocusPath } from "@/components/pwa/resume";
import { NAV_ITEMS, type NavItem } from "./nav-items";

/** `force` shows the nav even in workout focus mode (a 404 on a stale workout link). */
export function BottomNav({ force = false }: { force?: boolean }) {
  const pathname = usePathname();
  // The tab whose navigation is under way: it lights at once and the current
  // one lets go, instead of the old tab staying lit until the new page loads.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Focus mode: hide the nav during a live workout so a mistap can't drop the
  // user out mid-session (the post-workout summary keeps the nav).
  if (!force && isWorkoutFocusPath(pathname)) return null;

  return (
    // Height is pinned to --nav-h (globals.css) — bar + home-indicator inset —
    // so sticky bars and the app <main> can clear it exactly.
    <nav
      aria-label="Navegação principal"
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
                className="flex h-full touch-manipulation select-none active:bg-[var(--ink-3)]"
              >
                <TabFace item={item} lit={pendingHref ? pendingHref === item.href : active} onPending={setPendingHref} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * A tab's icon, label and accent keel. Lives inside the <Link> so it can read
 * the link's pending state (useLinkStatus): the tapped tab lights the moment
 * the navigation starts, before the next page has answered.
 */
function TabFace({
  item,
  lit,
  onPending,
}: {
  item: NavItem;
  lit: boolean;
  onPending: (update: (current: string | null) => string | null) => void;
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
        "relative flex w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-100",
        on ? "text-accent" : "text-muted",
        pending && "bg-[var(--ink-3)]",
      )}
    >
      <Icon className="size-5" strokeWidth={on ? 2.4 : 2} />
      {item.label}
      {/* The keel: the accent rule under a lit tab (square, like the buttons' bevel). */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-4 bottom-0 h-[3px] bg-accent transition-opacity duration-100",
          on ? "opacity-100" : "opacity-0",
        )}
      />
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
