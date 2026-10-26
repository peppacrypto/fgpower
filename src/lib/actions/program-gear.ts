"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { EQUIPMENT_FOR_ACCESS, needsStandIn, standInRange } from "@/lib/data/alternatives";
import { MAX_DAY_EXERCISES, MAX_PROGRAM_DAYS } from "@/lib/validation/program-builder-constants";
import type { ActionResult } from "./result";

/** Longer than any cuid: a field naming one is forged, not stale. */
const MAX_ID = 64;
/** Every row a program can hold (the builder's caps): a form naming more is forged. */
const MAX_ROWS = MAX_PROGRAM_DAYS * MAX_DAY_EXERCISES;

/** One reviewed choice: an exercise of one day — every row of the day that prescribes it — and what replaces it. */
interface Choice {
  exerciseId: string;
  rowIds: string[];
  /** The stand-in's id, or "keep". */
  value: string;
}

/** `swap:<exerciseId>:<rowId>[,<rowId>…]` → the exercise and its rows; null when the name isn't one the review writes. */
function parseField(key: string): { exerciseId: string; rowIds: string[] } | null {
  const parts = key.slice("swap:".length).split(":");
  if (parts.length !== 2) return null;
  const [exerciseId, list] = parts;
  const rowIds = list.split(",");
  if (!exerciseId || exerciseId.length > MAX_ID || rowIds.length > MAX_DAY_EXERCISES) return null;
  if (rowIds.some((id) => id.length === 0 || id.length > MAX_ID)) return null;
  return { exerciseId, rowIds };
}

/**
 * "Ajustar à minha academia" (/app/programs/[id]/academia): the stand-ins the
 * user reviewed go into their program for good. Each field is one exercise of
 * one day, named `swap:<exerciseId>:<rowId>[,<rowId>…]` — every row of the day
 * that prescribes it, so a lift's top set and its back-off swap together — and
 * holds the exercise to use instead, or "keep".
 *
 * Everything is checked before anything is written: the program is the user's;
 * every row is one of its rows, named once, and still prescribes the exercise
 * the review showed; every stand-in is a published exercise the gym can do now
 * (the access level and Settings → Minha academia, read fresh — never one that
 * needs only missing gear). A review that no longer matches — the program
 * edited or the gym changed meanwhile, or a forged field — goes back to the
 * review (?mudou=1) with nothing saved; someone else's program, to the shelf.
 *
 * A row takes its stand-in the way keepSwapInProgram writes one: its note goes
 * (it coached the old movement), its range follows the stand-in across a
 * reps↔seconds change, or moves toward the end that fits a harder or easier
 * one (alternatives standInRange); sets, rest, effort and its superset stay.
 * The program counts as saved now, so a builder draft kept from before reads as
 * older. Workouts already open keep their own copy. Lands on the program,
 * which says how many exercises were swapped; only a gone session comes back.
 */
export async function applyGymStandIns(programId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof programId !== "string" || programId.length === 0 || programId.length > MAX_ID || !(formData instanceof FormData)) {
    redirect("/app/programs");
  }

  const program = await prisma.userProgram.findFirst({
    where: { id: programId, userId: user.id },
    select: {
      id: true,
      days: {
        select: {
          id: true,
          exercises: {
            select: {
              id: true,
              exerciseId: true,
              repMin: true,
              repMax: true,
              notes: true,
              exercise: { select: { slug: true, difficulty: true } },
            },
          },
        },
      },
    },
  });
  if (!program) redirect("/app/programs");
  const review = `/app/programs/${program.id}/academia?mudou=1`;
  const rows = new Map(program.days.flatMap((d) => d.exercises.map((ex) => [ex.id, { ...ex, dayId: d.id }] as const)));

  // The review as posted: each row named once, all of a field's rows on one day and on the exercise shown.
  const choices: Choice[] = [];
  const named = new Set<string>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("swap:")) continue;
    const field = parseField(key);
    if (!field || typeof value !== "string" || value.length === 0 || value.length > MAX_ID) redirect(review);
    const dayIds = new Set<string>();
    for (const rowId of field.rowIds) {
      const row = rows.get(rowId);
      if (!row || named.has(rowId) || row.exerciseId !== field.exerciseId) redirect(review);
      named.add(rowId);
      dayIds.add(row.dayId);
    }
    if (dayIds.size !== 1 || named.size > MAX_ROWS) redirect(review);
    choices.push({ ...field, value });
  }

  // The stand-ins, judged against the gym as it is now.
  const swaps = choices.filter((c) => c.value !== "keep" && c.value !== c.exerciseId);
  const wanted = [...new Set(swaps.map((c) => c.value))];
  const [subs, profile] = await Promise.all([
    wanted.length > 0
      ? prisma.exercise.findMany({
          where: { id: { in: wanted }, isPublished: true },
          select: { id: true, slug: true, equipmentId: true, category: true, difficulty: true },
        })
      : Promise.resolve([]),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { equipmentAccess: true, missingGear: true } }),
  ]);
  const gym = {
    allowed: EQUIPMENT_FOR_ACCESS[profile?.equipmentAccess ?? "FULL_GYM"] ?? null,
    missingGear: profile?.missingGear ?? [],
  };
  const byId = new Map(subs.map((s) => [s.id, s]));
  for (const id of wanted) {
    const sub = byId.get(id);
    if (!sub || needsStandIn(sub, gym)) redirect(review);
  }

  const swapped = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const choice of swaps) {
      const sub = byId.get(choice.value)!;
      let changed = false;
      for (const rowId of choice.rowIds) {
        const range = standInRange(rows.get(rowId)!, sub);
        // Only while the row still prescribes what was reviewed (a save meanwhile wins).
        const res = await tx.userProgramExercise.updateMany({
          where: { id: rowId, exerciseId: choice.exerciseId, day: { programId: program.id } },
          data: { exerciseId: sub.id, notes: null, repMin: range.repMin, repMax: range.repMax },
        });
        if (res.count > 0) changed = true;
      }
      if (changed) count++;
    }
    // The builder's local draft is judged against the program's updatedAt (draftIsStale).
    if (count > 0) await tx.userProgram.update({ where: { id: program.id }, data: { updatedAt: new Date() } });
    return count;
  });

  if (swapped > 0) {
    revalidatePath(`/app/programs/${program.id}`);
    revalidatePath("/app/programs");
    revalidatePath("/app/today");
  }
  redirect(`/app/programs/${program.id}?academia=${swapped}`);
}
