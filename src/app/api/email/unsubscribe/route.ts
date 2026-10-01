import { NextResponse } from "next/server";
import { unsubscribeDigestByToken } from "@/lib/reminders/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click unsubscribe for the weekly digest (the List-Unsubscribe
 * header Gmail and Apple Mail turn into "Cancelar inscrição"): POST with the
 * signed `t`. GET (a person following the header's link) goes to the page
 * that asks first — a GET never changes anything.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  const ok = await unsubscribeDigestByToken(token);
  return new NextResponse(ok ? "ok" : "invalid", { status: ok ? 200 : 400, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  // Relative: behind the host's proxy request.url carries the server's own host, not the site's.
  return new NextResponse(null, {
    status: 303,
    headers: { "cache-control": "no-store", location: `/email/cancelar?t=${encodeURIComponent(token)}` },
  });
}
