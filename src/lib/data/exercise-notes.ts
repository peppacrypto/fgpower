import "server-only";
import { prisma } from "@/lib/db";
import { EXERCISE_NOTE_MAX } from "@/lib/validation/program-builder";

/**
 * The exercise-note write itself, given a user id the caller has already
 * established as the viewer: the session-checked action (lib/actions/
 * exercise-notes saveExerciseNote) and the A-074 keepalive route (api/workout/
 * notes), which both resolve the session first and pass that id. It lives here,
 * a server-only helper, rather than in the "use server" action module, so it is
 * never itself a callable server action with a caller-supplied userId. Same
 * trimming and A-003 cap as the action.
 */
export async function persistExerciseNote(userId: string, exerciseId: string, note: string) {
  // The callers are public POST endpoints: never trust the payload's shape or size.
  const id = typeof exerciseId === "string" ? exerciseId : "";
  const trimmed = (typeof note === "string" ? note : "").trim();
  if (!id || !trimmed) {
    await prisma.exerciseUserNote.deleteMany({ where: { userId, exerciseId: id } });
    return;
  }
  // Cap at the same bound the builder enforces (A-003).
  const capped = trimmed.slice(0, EXERCISE_NOTE_MAX);
  await prisma.exerciseUserNote.upsert({
    where: { userId_exerciseId: { userId, exerciseId: id } },
    create: { userId, exerciseId: id, note: capped },
    update: { note: capped },
  });
}
