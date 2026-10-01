import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runReminderTick } from "@/lib/reminders/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

/**
 * The reminder tick (W-017), called every 5 minutes by the in-process
 * scheduler (src/instrumentation.ts) with `Authorization: Bearer
 * $CRON_SECRET`. 404 without a secret configured, 401 with a wrong one.
 * `?dry=1` decides and reports without writing or sending; `?now=<ISO>`
 * pretends another time — outside production only.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  let now = new Date();
  const at = params.get("now");
  if (at && process.env.NODE_ENV !== "production") {
    const parsed = new Date(at);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "bad now" }, { status: 400 });
    now = parsed;
  }
  const summary = await runReminderTick(now, { dryRun: params.get("dry") === "1" });
  return NextResponse.json(summary, { headers: { "cache-control": "no-store" } });
}

function bearerMatches(header: string | null, secret: string): boolean {
  const given = Buffer.from(header?.startsWith("Bearer ") ? header.slice(7) : "", "utf8");
  const expected = Buffer.from(secret, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
