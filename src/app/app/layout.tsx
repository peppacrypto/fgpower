import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { PATH_HEADER } from "@/lib/auth/path-header";
import { onboardingNextPath } from "@/lib/auth/safe-next";
import { hasCompletedOnboarding } from "@/lib/data/profile";
import { AppShell } from "@/components/nav/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();

  const onboarded = await hasCompletedOnboarding(user.id);
  if (!onboarded) {
    // The wizard comes back to the page that was asked for (a program opened
    // from a shared profile, say) — Today needs no `next`.
    const next = onboardingNextPath((await headers()).get(PATH_HEADER));
    redirect(next && next !== "/app/today" ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
