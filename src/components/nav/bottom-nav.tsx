"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isWorkoutFocusPath } from "@/components/pwa/resume";
import { NAV_ITEMS } from "./nav-items";

/** `force` shows the nav even in workout focus mode (a 404 on a stale workout link). */
export function BottomNav({ force = false }: { force?: boolean }) {
  const pathname = usePathname();

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
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
