"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, History, LogOut, Settings, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Wordmark } from "@/components/brand/logo";
import { authClient } from "@/lib/auth/auth-client";
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

const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
    active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground",
  );

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 px-4 py-6 sm:flex">
      <Link href="/app/today" className="px-2">
        <Wordmark />
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
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
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {isAdmin ? (
          <Link
            href="/admin"
            className="mt-4 flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <Shield className="size-[18px]" />
            Admin
          </Link>
        ) : null}
      </nav>

      <button
        onClick={async () => {
          await authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
        }}
        className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground"
      >
        <LogOut className="size-[18px]" />
        Sair
      </button>
    </aside>
  );
}
