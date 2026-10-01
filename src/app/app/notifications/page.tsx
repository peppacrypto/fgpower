import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getNotifications } from "@/lib/data/social";
import { BUCKET_LABEL, type NotificationBucket } from "@/lib/social/notification-groups";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";
import { InboxMasthead } from "./inbox-masthead";
import { NotificationItem } from "./notification-item";
import { MarkSeen } from "./mark-seen";

export const metadata: Metadata = { title: "Notificações" };

const BUCKETS: NotificationBucket[] = ["today", "week", "earlier"];

/**
 * The inbox (W-042): a timeline under Hoje / Esta semana / Antes, with the
 * rows that are new marked for this visit (through any server re-render).
 * Opening it marks them seen from the browser (MarkSeen), never during this
 * render — a prefetch must not count as seen.
 */
export default async function NotificationsPage() {
  const user = await requireUser();
  const { lines, unread, newestAt } = await getNotifications(user.id, new Date());
  const buckets = BUCKETS.map((bucket) => ({ bucket, lines: lines.filter((l) => l.bucket === bucket) })).filter(
    (b) => b.lines.length > 0,
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <InboxMasthead unread={unread} />
      {unread > 0 && newestAt ? <MarkSeen upTo={newestAt} /> : null}

      {lines.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Bell className="size-8" />}
            title="Nenhuma notificação ainda"
            description="Aqui aparecem os FGs (reconhecimento pelo treino) nos treinos que você compartilha, novos seguidores e pedidos para te seguir."
            action={
              <Button variant="outline" size="sm" asChild className="mt-1 min-h-11">
                <Link href="/app/discover">Encontrar pessoas</Link>
              </Button>
            }
          />
        </div>
      ) : (
        buckets.map(({ bucket, lines: bucketLines }) => (
          <section key={bucket} aria-labelledby={`notificacoes-${bucket}`} className="mt-8">
            <SectionHead id={`notificacoes-${bucket}`} label={BUCKET_LABEL[bucket]} count={plural(bucketLines.length, "aviso", "avisos")} />
            <div className="mt-2">
              {bucketLines.map((line) => (
                <NotificationItem key={line.key} line={line} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
