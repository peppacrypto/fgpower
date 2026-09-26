import { NextResponse } from "next/server";
import { syncSets, type SetSyncOp } from "@/lib/actions/workouts";
import { isSameOrigin } from "../same-origin";

/**
 * The workout screen's outbox: row writes (✓, un-✓, typed values) sent as a
 * plain request instead of a server action, so a ✓ never queues behind other
 * actions or a page re-render, can be retried after a lost connection or a
 * deploy (no action id to go stale), and can go out as a `keepalive` request
 * while the page unloads. Same rules as the set actions: session cookie, the
 * user's own in-progress sets only, idempotent per set.
 */
export async function POST(request: Request) {
  // Same-origin only: the session cookie must not be usable from another site.
  // An opaque origin ("null", from a sandboxed frame or a privacy redirect) is refused too.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { ops?: unknown } | null;
  const ops = Array.isArray(body?.ops) ? (body.ops as SetSyncOp[]) : [];
  try {
    return NextResponse.json(await syncSets(ops));
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
