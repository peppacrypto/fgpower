import "server-only";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_SELECT, toPublicUser } from "./public-user";

/** Who follows whom: requests, followers, following, blocks. */

export async function getPendingFollowRequests(userId: string) {
  const requests = await prisma.followRequest.findMany({
    where: { targetId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { requester: { select: PUBLIC_USER_SELECT } },
  });
  return requests.map((r) => ({ ...r, requester: toPublicUser(r.requester) }));
}
