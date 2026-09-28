/**
 * Pages anyone can open without an account — a public profile (/u/<handle>)
 * and, from Batch 5, a shared workout (/t/<token>). The URLs don't change
 * with the group.
 *
 * Phase 0: a pass-through, so these pages look exactly as before. The
 * discovery cluster (C2, W-140) makes this the shell switch: the app's shell
 * (components/nav/app-shell.tsx AppShell) for a signed-in, onboarded viewer,
 * the public header (PublicShell) for everyone else.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
