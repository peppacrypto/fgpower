import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getNotifications } from "@/lib/data/social";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Masthead } from "@/components/ui/masthead";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";
import { NotificationItem } from "./notification-item";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <Masthead kicker="Sua atividade" title="Notificações" />

      {notifications.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Bell className="size-8" />}
            title="Nenhuma notificação ainda"
            description="Aqui aparecem os FGs nos treinos que você compartilha, novos seguidores e pedidos para te seguir."
            action={
              <Button variant="outline" size="sm" asChild className="mt-1 min-h-11">
                <Link href="/app/discover">Encontrar pessoas</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <section className="mt-8">
          <SectionHead
            label="Recentes"
            count={`${plural(notifications.length, "aviso", "avisos")}${unread > 0 ? ` · ${plural(unread, "nova", "novas")}` : ""}`}
          />
          <div className="mt-2">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
