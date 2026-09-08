import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { hasCompletedOnboarding } from "@/lib/data/profile";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { isAdminUser } from "@/lib/auth/roles";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();

  const onboarded = await hasCompletedOnboarding(user.id);
  if (!onboarded) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar isAdmin={isAdminUser(user)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pb-20 sm:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
