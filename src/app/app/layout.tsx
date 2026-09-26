import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { hasCompletedOnboarding } from "@/lib/data/profile";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { AppMain } from "@/components/nav/app-main";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ResumeRefresh } from "@/components/pwa/resume-refresh";
import { isAdminUser } from "@/lib/auth/roles";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();

  const onboarded = await hasCompletedOnboarding(user.id);
  if (!onboarded) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-dvh">
      {/* Paints the status-bar inset (0 unless the page is drawn under the
          status bar) so scrolled content never shows through behind it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top,0px)] bg-background sm:hidden"
      />
      <Sidebar isAdmin={isAdminUser(user)} />
      <div className="flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top,0px)] sm:pt-0">
        <OfflineBanner />
        <AppMain>{children}</AppMain>
      </div>
      <BottomNav />
      <ResumeRefresh />
    </div>
  );
}
