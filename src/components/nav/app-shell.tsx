import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { AppMain } from "@/components/nav/app-main";
import { NavHistoryTracker } from "@/components/nav/nav-history";
import { UnreadProvider } from "@/components/nav/unread-provider";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ResumeRefresh } from "@/components/pwa/resume-refresh";
import { isAdminUser } from "@/lib/auth/roles";
import { countUnread } from "@/lib/social/notifications";
import { countOpenReports } from "@/lib/social/notification-reports";

/**
 * The signed-in app's chrome: desktop sidebar, bottom nav, <main>, offline
 * banner — around /app pages (app/layout.tsx) and, for a signed-in onboarded
 * viewer, around public pages too ((public)/layout.tsx), so a profile opened
 * from the feed keeps the navigation. A server component that loads what the
 * chrome shows for this user — the admin link, the unread-notifications
 * count and, for admins, the reports waiting — so both layouts just pass the
 * user. A count that fails to load is 0: the chrome never breaks a page.
 */
export async function AppShell({
  user,
  children,
}: {
  user: { id: string; email: string; role?: string | null };
  children: React.ReactNode;
}) {
  const isAdmin = isAdminUser(user);
  const [unread, openReports] = await Promise.all([
    countUnread(user.id).catch(() => 0),
    isAdmin ? countOpenReports().catch(() => 0) : Promise.resolve(null),
  ]);

  return (
    <UnreadProvider initial={unread} initialOpenReports={openReports}>
      <div className="flex min-h-dvh">
        {/* Paints the status-bar inset (0 unless the page is drawn under the
            status bar) so scrolled content never shows through behind it. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top,0px)] bg-background sm:hidden"
        />
        <Sidebar isAdmin={isAdmin} />
        <div className="flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top,0px)] sm:pt-0">
          <OfflineBanner />
          <AppMain>{children}</AppMain>
        </div>
        <BottomNav />
        <ResumeRefresh />
        <NavHistoryTracker />
      </div>
    </UnreadProvider>
  );
}
