import { getCurrentSession } from "@/lib/auth/require-user";
import { hasCompletedOnboarding } from "@/lib/data/profile";
import { AppShell } from "@/components/nav/app-shell";
import { PublicShell } from "@/components/nav/public-shell";

/**
 * Pages anyone can open without an account — a public profile (/u/<handle>)
 * and a shared workout (/t/<token>). The URLs don't change with the group.
 *
 * The shell follows the viewer (W-140): someone signed in and onboarded stays
 * in the app — bottom nav, sidebar, "‹ Voltar" back to where they came from —
 * so a profile opened from the feed isn't a dead end in the installed PWA;
 * everyone else gets the public header, whose buttons come back here after
 * signing in (or finishing the onboarding).
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (session && (await hasCompletedOnboarding(session.user.id))) {
    return <AppShell user={session.user}>{children}</AppShell>;
  }
  return <PublicShell pendingOnboarding={Boolean(session)}>{children}</PublicShell>;
}
