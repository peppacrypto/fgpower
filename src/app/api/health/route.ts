import { prisma } from "@/lib/db";

/**
 * Liveness for the host's health check: public, so it says only whether the
 * database answers. The error itself (it can name the database host) goes to
 * the server log, never to the caller.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("health check: database unreachable", err);
    return Response.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
