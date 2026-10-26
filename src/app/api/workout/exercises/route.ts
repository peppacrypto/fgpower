import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/require-user";
import { getExerciseOptions } from "@/lib/data/workout-session";
import { isSameOrigin } from "../same-origin";

/**
 * The workout's "Trocar" / "Adicionar exercício" sheet (W-006): stand-ins for
 * an exercise of a workout in progress, or a library search — only what the
 * user's gym can do (Settings → Minha academia), each with the apparatus it
 * takes (`gearPt`). A plain GET rather than a server action, so a keystroke's
 * search can be cancelled by the next one and never queues behind the
 * workout's other actions; it reads the gym fresh on every call, so a list
 * fetched again after "Não tenho este aparelho" already leaves that one out.
 * ?session=<id>&log=<exerciseLogId>&q=<query>
 */
export async function GET(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await getCurrentSession();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session") ?? "";
  if (!sessionId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const result = await getExerciseOptions(auth.user.id, {
    sessionId,
    exerciseLogId: url.searchParams.get("log"),
    q: url.searchParams.get("q"),
  });
  if (!result) return NextResponse.json({ error: "closed" }, { status: 409 });
  return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
}
