"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { canGoBack, noteBackNavigation } from "./nav-history";

/**
 * "‹ Voltar": back to the previous page of this visit (URL and scroll) when
 * there is one in the app, else to `fallbackHref` — a real link, so it works
 * before hydration and in a new tab. A deep link (a shared profile opened
 * from WhatsApp) never sends the user back out of the app.
 */
export function BackLink({
  fallbackHref,
  label = "Voltar",
  className,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={fallbackHref}
      onClick={(e) => {
        // A new tab / window keeps the plain link.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!canGoBack()) return;
        e.preventDefault();
        noteBackNavigation();
        router.back();
      }}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground",
        className,
      )}
    >
      <span aria-hidden>‹</span>
      {label}
    </Link>
  );
}
