import { prisma } from "@/lib/db";
import { buildSha } from "@/lib/build-info";

/**
 * Liveness for the host's health check: public, so it says only whether the
 * database answers and which build is running. The error itself (it can name
 * the database host) goes to the server log, never to the caller.
 */
export async function GET() {
  const sha = buildSha();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "connected", sha });
  } catch (err) {
    console.error("health check: database unreachable", err);
    return Response.json({ status: "error", db: "unreachable", sha }, { status: 503 });
  }
}
