import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { prisma } from "@/lib/db";
import { verifyLink } from "@/lib/links/signed";

export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

/**
 * A reminder's tracked tap (push or digest, W-017): marks the delivery
 * clicked — and so engaged, which keeps reminders from pausing — then goes
 * on to its app page (the login page first when signed out). A bad token
 * still lands on Today. HEAD never writes (link scanners, prefetch).
 */
export async function GET(_request: Request, { params }: RouteContext<"/r/[token]">) {
  const { token } = await params;
  const data = verifyLink("click", token);
  const to = safeNextPath(data?.to) ?? "/app/today";
  if (data?.d) {
    const now = new Date();
    await prisma.reminderDelivery
      .updateMany({ where: { id: data.d, userId: data.u, clickedAt: null }, data: { clickedAt: now, engagedAt: now } })
      .catch((err) => console.error("[r] click not recorded", err));
  }
  return seeOther(to);
}

export async function HEAD(_request: Request, { params }: RouteContext<"/r/[token]">) {
  const { token } = await params;
  return seeOther(safeNextPath(verifyLink("click", token)?.to) ?? "/app/today");
}

/**
 * A relative Location (an app path from safeNextPath): the browser resolves
 * it against the address it opened. Behind the host's proxy a route
 * handler's request.url carries the server's own host (localhost:$PORT),
 * so an absolute URL built from it would leave the site.
 */
function seeOther(path: string) {
  return new NextResponse(null, { status: 303, headers: { ...HEADERS, location: path } });
}
