import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/require-user";
import { getTechniqueSheet } from "@/lib/data/workout-session";
import { isSameOrigin } from "../same-origin";

/**
 * The workout's technique sheet (W-025): an exercise's start/end frames and
 * three key cues, fetched when the sheet opens so the workout screen's own
 * data stays small. Exercise content changes rarely: the browser may keep it
 * for the rest of the workout. ?exercise=<id>
 */
export async function GET(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await getCurrentSession();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const exerciseId = new URL(request.url).searchParams.get("exercise") ?? "";
  const sheet = exerciseId ? await getTechniqueSheet(exerciseId) : null;
  if (!sheet) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(sheet, { headers: { "cache-control": "private, max-age=3600" } });
}
