"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isWorkoutFocusPath } from "@/components/pwa/resume";

/**
 * The app's <main>. --nav-h clears the fixed bottom nav (home-indicator inset
 * included) — except on the live workout, where the nav is hidden and the
 * screen keeps its own bottom space for the rest timer.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <main className={cn("flex-1 sm:pb-0", !isWorkoutFocusPath(pathname) && "pb-[var(--nav-h)]")}>{children}</main>;
}
