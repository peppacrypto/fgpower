import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Dev/test-only view of the dev e-mail transport (lib/email/send.ts): the
 * newest message logged for an address, with its plain-text body — how e2e
 * reads a login code or a digest. `?to=<address>[&kind=LOGIN_CODE]`. 404 in
 * production, like /api/test/login (production never uses the dev transport
 * and never stores a body either).
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const params = new URL(request.url).searchParams;
  const to = params.get("to")?.trim().toLowerCase();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });
  const kind = params.get("kind")?.trim() || undefined;

  const message = await prisma.emailMessage.findFirst({
    where: { toEmail: to, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, subject: true, devBody: true, status: true, createdAt: true },
  });
  if (!message) return NextResponse.json({ error: "empty" }, { status: 404, headers: { "cache-control": "no-store" } });
  return NextResponse.json(message, { headers: { "cache-control": "no-store" } });
}
