import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { purgeExpiredSessions } from "@/lib/auth/session-maintenance";

/**
 * A-051: expired sign-in sessions (with their stored IP + user agent) are
 * purged so they do not outlive the ~90-day session lifetime the privacy
 * policy states. Runs on the periodic cron tick.
 */

const RUN = `sessmaint-${Date.now()}`;
const USER_ID = `${RUN}-u`;
const now = new Date();
const DAY = 86_400_000;

async function session(id: string, expiresAt: Date) {
  await prisma.session.create({
    data: { id, token: id, userId: USER_ID, expiresAt, ipAddress: "1.2.3.4", userAgent: "test-agent" },
  });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER_ID, name: USER_ID, email: `${USER_ID}@fgpower.test`, emailVerified: true } });
  await session(`${RUN}-expired`, new Date(now.getTime() - DAY));
  await session(`${RUN}-valid`, new Date(now.getTime() + 30 * DAY));
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.$disconnect();
});

describe("purgeExpiredSessions (A-051)", () => {
  it("deletes expired sessions, keeps valid ones, and is idempotent", async () => {
    const purged = await purgeExpiredSessions(now);
    expect(purged).toBeGreaterThanOrEqual(1); // at least our expired one
    expect(await prisma.session.findUnique({ where: { id: `${RUN}-expired` } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: `${RUN}-valid` } })).not.toBeNull();

    // Idempotent: a re-run at the same instant removes nothing more of ours.
    await purgeExpiredSessions(now);
    expect(await prisma.session.count({ where: { userId: USER_ID } })).toBe(1);
  });
});
