import "server-only";
import { prisma } from "@/lib/db";

/**
 * Delete expired sign-in sessions — better-auth Session rows past `expiresAt`.
 * They are already invalid (the session lifetime is ~90 days, renewed on use),
 * and removing them keeps the IP address + user agent stored on each session
 * from lingering past the retention the privacy policy states (A-051, LGPD data
 * minimization). Runs on the periodic cron tick. Idempotent — a re-run finds
 * nothing new to delete.
 */
export async function purgeExpiredSessions(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}
