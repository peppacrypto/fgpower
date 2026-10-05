import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/require-user";
import { persistExerciseNote } from "@/lib/data/exercise-notes";
import { isSameOrigin } from "../same-origin";

/**
 * Last-chance autosave of a typed exercise note when the workout page is
 * unloaded (tab closed, app killed): a server action can't start then, but a
 * `keepalive` fetch can. Same rules as saveExerciseNote: session cookie, the
 * user's own notes only. The screen debounce-saves while typing (A-074); this
 * catches the final fragment.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const auth = await getCurrentSession();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { notes?: unknown } | null;
  const notes = Array.isArray(body?.notes)
    ? (body.notes as { exerciseId?: unknown; note?: unknown }[]).slice(0, 50)
    : [];
  let saved = 0;
  for (const n of notes) {
    if (typeof n?.exerciseId !== "string") continue;
    try {
      await persistExerciseNote(auth.user.id, n.exerciseId, typeof n.note === "string" ? n.note : "");
      saved++;
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.json({ saved });
}
