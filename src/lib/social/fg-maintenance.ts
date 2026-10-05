import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Account deletion & ghost FGs (A-047).
 *
 * When a user is deleted the DB cascades their ActivityFG rows away (schema:
 * ActivityFG.user onDelete Cascade) but never touches Activity.fgCount — a
 * denormalized counter — so every post they had given FG to keeps counting a
 * giver who no longer exists ("FG de Bruno e mais 1").
 *
 * Called from better-auth's deleteUser.beforeDelete (lib/auth/auth.ts) while the
 * giver's rows still exist: it removes them and recomputes fgCount for the
 * affected posts in one transaction — the same delete-then-recount blockUser
 * (lib/actions/social.ts) takes, in the same lock order (the post before its FGs).
 * The user cascade that follows then finds no rows left to drop, and the counts
 * are already correct.
 *
 * A giver never holds an FG on their own post (giveFg refuses
 * CANNOT_FG_OWN_ACTIVITY), so every affected Activity belongs to someone else and
 * survives the account deletion.
 */
export async function recountFgForDeletedGiver(userId: string): Promise<void> {
  const given = await prisma.activityFG.findMany({ where: { userId }, select: { activityId: true } });
  const ids = [...new Set(given.map((f) => f.activityId))];
  if (ids.length === 0) return;
  await prisma.$transaction(async (tx) => {
    // The posts before their FGs: the lock order a post's deletion (it cascades to
    // its FGs) and removeFg / blockUser take (social.lock-order.integration.test.ts).
    await tx.$queryRaw`SELECT id FROM "Activity" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR NO KEY UPDATE`;
    await tx.activityFG.deleteMany({ where: { userId, activityId: { in: ids } } });
    await tx.$executeRaw`
      UPDATE "Activity" SET "fgCount" = (SELECT count(*) FROM "ActivityFG" f WHERE f."activityId" = "Activity"."id")
      WHERE "id" IN (${Prisma.join(ids)})`;
  });
}
