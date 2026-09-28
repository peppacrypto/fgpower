import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    // Default-deny for secrets in rows: Activity.shareToken opens that workout
    // to anyone holding the link, so it is never part of a row (feed, profile,
    // activity page, includes) unless a query asks for it — `select: {
    // shareToken: true }` or `omit: { shareToken: false }`. A per-query omit
    // would be one forgotten spot away from a leak.
    omit: { activity: { shareToken: true } },
  });
}

// Reuse a single PrismaClient across hot reloads in development so we don't
// exhaust the Postgres connection pool. In production each server instance
// creates exactly one client.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
  prismaClass?: typeof PrismaClient;
};

// `prisma generate` while `next dev` runs loads a new client class: the cached
// instance was built from the old one (old schema, old options), so it is
// replaced instead of reused. Its idle pool connections time out on their own.
const cached = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
export const prisma = cached ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClass = PrismaClient;
}
