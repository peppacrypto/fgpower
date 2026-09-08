"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Wordmark } from "@/components/brand/logo";
import { authClient } from "@/lib/auth/auth-client";
import { NAV_ITEMS } from "./nav-items";

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
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}

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
