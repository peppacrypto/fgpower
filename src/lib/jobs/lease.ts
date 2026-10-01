import "server-only";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * One runner at a time for a periodic job (the reminder tick), across
 * processes: a named JobLease row taken with one INSERT … ON CONFLICT … WHERE
 * (no connection held while the job runs). A holder whose lease expired
 * (crashed, deploy overlap) is simply overtaken after `ttlMs`. The row also
 * keeps the last run's time and result for the admin panel ("Último ciclo").
 * Times are wall-clock (never a simulated "now").
 */
export async function withLease<T>(
  name: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ ran: false } | { ran: true; result: T }> {
  const holder = `${hostname()}:${process.pid}:${randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const taken = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO "JobLease" (name, holder, "expiresAt", "updatedAt")
    VALUES (${name}, ${holder}, ${expiresAt}, ${now})
    ON CONFLICT (name) DO UPDATE
      SET holder = EXCLUDED.holder, "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = EXCLUDED."updatedAt"
      WHERE "JobLease"."expiresAt" < ${now} OR "JobLease".holder = EXCLUDED.holder
    RETURNING name`;
  if (taken.length === 0) return { ran: false };

  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await fn() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  const finished = new Date();
  const lastResult = outcome.ok
    ? toJson(outcome.value)
    : { error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error) };
  await prisma.jobLease
    .updateMany({
      where: { name, holder },
      data: { expiresAt: finished, lastRunAt: finished, lastResult: lastResult ?? Prisma.JsonNull },
    })
    .catch((err) => console.error("[lease] release failed", name, err));
  if (!outcome.ok) throw outcome.error;
  return { ran: true, result: outcome.value };
}

function toJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

/** When the job last finished and what it said (admin). */
export async function lastLeaseRun(name: string) {
  return prisma.jobLease.findUnique({ where: { name }, select: { lastRunAt: true, lastResult: true, expiresAt: true } });
}
