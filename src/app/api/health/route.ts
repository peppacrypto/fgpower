import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "connected" });
  } catch (err) {
    return Response.json({ status: "error", message: String(err) }, { status: 503 });
  }
}
