"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, History, Settings, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav-items";

/** Destinations without a tab of their own that get a dedicated sidebar link on desktop. */
const SECONDARY_ITEMS = [
  { href: "/app/history", label: "Histórico", icon: History },
  { href: "/app/science", label: "Ciência", icon: BookOpen },
  { href: "/app/feed", label: "Feed", icon: Users },
  { href: "/app/notifications", label: "Notificações", icon: Bell },
  { href: "/app/settings", label: "Configurações", icon: Settings },
] as const;
const SECONDARY_HREFS = new Set<string>(SECONDARY_ITEMS.map((i) => i.href));

const within = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// Square, like the rest of the Dossiê: the lit link carries an accent keel on
// its left edge and a heavier weight, not a tint alone.
const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors",
    active
      ? "border-l-accent bg-accent-soft font-semibold text-accent"
      : "border-l-transparent font-medium text-muted hover:bg-surface-2 hover:text-foreground",
  );

/** The sidebar's links: the client island of the (server) Sidebar — it lights by the current path. */
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação lateral" className="mt-8 flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          within(pathname, item.href) ||
          // Destinations with their own link below light that link, not the
          // tab that stands in for them on the phone's bottom nav.
          (item.activePaths?.some((p) => !SECONDARY_HREFS.has(p) && within(pathname, p)) ?? false);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
            <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
        {SECONDARY_ITEMS.map((item) => {
          const active = within(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
              <Icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {isAdmin ? (
        <Link href="/admin" className={cn(linkClass(false), "mt-4")}>
          <Shield className="size-[18px]" />
          Admin
        </Link>
      ) : null}
    </nav>
  );
}
