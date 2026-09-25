import { NextResponse } from "next/server";
import { saveSetValues, type LogSetInput } from "@/lib/actions/workouts";

/**
 * Last-chance autosave of typed set values when the workout page is being
 * unloaded (tab closed, app killed): a server action can't start at that
 * point, but a `keepalive` fetch can. Same rules as the saveSetValues action
 * (session cookie, the user's own in-progress sets only).
 */
export async function POST(request: Request) {
  // Same-origin only: the session cookie must not be usable from another site.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { rows?: unknown } | null;
  const rows = Array.isArray(body?.rows) ? (body.rows as LogSetInput[]).slice(0, 200) : [];
  let saved = 0;
  for (const row of rows) {
    try {
      const r = await saveSetValues(row);
      if (r.ok) saved++;
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.json({ saved });
}
