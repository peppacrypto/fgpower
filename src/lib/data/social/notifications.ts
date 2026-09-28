import "server-only";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_SELECT, toPublicUser } from "./public-user";

/**
 * The notifications page's rows. Writing notifications is
 * lib/social/notifications.ts (createNotification), never here.
 */

export async function getNotifications(userId: string) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: PUBLIC_USER_SELECT },
      activity: { select: { id: true, sessionId: true } },
      followRequest: { select: { id: true, status: true } },
    },
  });
  return notifications.map((n) => ({ ...n, actor: n.actor ? toPublicUser(n.actor) : null }));
}
