import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getNotifications } from "@/lib/data/social";
import { EmptyState } from "@/components/ui/misc";
import { NotificationItem } from "./notification-item";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>

      {notifications.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Bell className="size-8" />} title="Nenhuma notificação ainda" />
        </div>
      ) : (
        <div className="mt-4">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
