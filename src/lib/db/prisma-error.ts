import { Prisma } from "@/generated/prisma/client";

/**
 * A Prisma unique-constraint violation (P2002): a concurrent write reached a
 * unique index first. The one check behind every "lost the race, treat it as
 * already done / already active / claimed elsewhere" catch — across server
 * actions, social publishing and the reminder engine.
 */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
