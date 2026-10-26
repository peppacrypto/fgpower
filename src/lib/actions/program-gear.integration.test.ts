import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

/**
 * "Ajustar à minha academia" (applyGymStandIns) against the real local
 * Postgres: the reviewed stand-ins go into the user's own program for good —
 * every row of the day that prescribes the exercise, its note cleared, its
 * range scaled or re-unit'd as keepSwapInProgram would, the program counted
 * as saved — and nothing at all is written when the review names a row that
 * isn't the program's (someone else's included), no longer matches it, or
 * picks a stand-in the gym can't do. The curated gear map is stubbed so the
 * gear each exercise needs is the test's own, whatever the content pass does.
 */

const { auth, gearMap } = vi.hoisted(() => ({
  auth: { userId: null as string | null },
  gearMap: {} as Record<string, readonly [readonly string[], string]>,
}));
vi.mock("@/lib/exercises/gear-map.generated", () => ({ GEAR_MAP: gearMap }));
vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!auth.userId) throw new Error("UNAUTHORIZED");
    return { id: auth.userId };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
class Redirected extends Error {
  constructor(public url: string) {
    super(`REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  RedirectType: { replace: "replace", push: "push" },
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

const { prisma } = await import("@/lib/db");
const { applyGymStandIns } = await import("./program-gear");

const RUN = `pgear-${Date.now()}`;
const OWNER = `${RUN}-owner`;
const OTHER = `${RUN}-other`;

/** Fire the action and return the redirect URL it threw (or rethrow anything else). */
async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const ex: Record<string, string> = {};
const SLUGS = ["hack-squat", "leg-press", "goblet-squat", "front-barbell-squat", "smith-machine-squat", "leg-extensions", "plank"];

/**
 * A program like GD's leg day: the Hack as a top set and a back-off (two rows),
 * the leg extension, and the Hack again on another day.
 */
async function seedProgram(userId: string) {
  const program = await prisma.userProgram.create({
    data: {
      userId,
      name: "Pernas",
      status: "ACTIVE",
      days: {
        create: [
          {
            dayIndex: 0,
            name: "Terça — Inferior",
            exercises: {
              create: [
                { exerciseId: ex["hack-squat"], sortOrder: 0, sets: 3, repMin: 3, repMax: 5, notes: "Top set: pesado." },
                { exerciseId: ex["hack-squat"], sortOrder: 1, sets: 2, repMin: 6, repMax: 10, notes: "Back-off." },
                { exerciseId: ex["leg-extensions"], sortOrder: 2, sets: 3, repMin: 10, repMax: 12, notes: "Segure 1 s em cima." },
              ],
            },
          },
          {
            dayIndex: 1,
            name: "Sexta — Inferior",
            exercises: { create: [{ exerciseId: ex["hack-squat"], sortOrder: 0, sets: 3, repMin: 8, repMax: 12 }] },
          },
        ],
      },
    },
    select: {
      id: true,
      updatedAt: true,
      days: { orderBy: { dayIndex: "asc" }, select: { id: true, exercises: { orderBy: { sortOrder: "asc" }, select: { id: true } } } },
    },
  });
  const [day0, day1] = program.days;
  return {
    id: program.id,
    updatedAt: program.updatedAt,
    top: day0.exercises[0].id,
    backOff: day0.exercises[1].id,
    extension: day0.exercises[2].id,
    friday: day1.exercises[0].id,
  };
}

const rowsOf = (programId: string) =>
  prisma.userProgramExercise.findMany({
    where: { day: { programId } },
    orderBy: [{ day: { dayIndex: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, exerciseId: true, sets: true, repMin: true, repMax: true, notes: true, restSeconds: true },
  });

beforeAll(async () => {
  for (const slug of SLUGS) ex[slug] = (await prisma.exercise.findUniqueOrThrow({ where: { slug }, select: { id: true } })).id;
  for (const id of [OWNER, OTHER]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
    await prisma.profile.create({ data: { userId: id, displayName: id } });
  }
});

beforeEach(async () => {
  auth.userId = OWNER;
  for (const slug of Object.keys(gearMap)) delete gearMap[slug];
  gearMap["hack-squat"] = [["hack-squat"], "PLATE_MACHINE"];
  gearMap["leg-press"] = [["leg-press"], "PLATE_MACHINE"];
  gearMap["smith-machine-squat"] = [["smith"], "BARBELL"];
  await prisma.userProgram.deleteMany({ where: { userId: { in: [OWNER, OTHER] } } });
  await prisma.profile.updateMany({
    where: { userId: { in: [OWNER, OTHER] } },
    data: { missingGear: ["hack-squat"], equipmentAccess: "FULL_GYM" },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } });
  await prisma.$disconnect();
});

describe("applyGymStandIns", () => {
  it("swaps every row of the day that prescribes it, clears its note and counts the program as saved", async () => {
    const p = await seedProgram(OWNER);
    const url = await redirectOf(
      applyGymStandIns(
        p.id,
        form({
          [`swap:${ex["hack-squat"]}:${p.top},${p.backOff}`]: ex["leg-press"],
          [`swap:${ex["hack-squat"]}:${p.friday}`]: ex["goblet-squat"],
          [`swap:${ex["leg-extensions"]}:${p.extension}`]: "keep",
        }),
      ),
    );
    expect(url).toBe(`/app/programs/${p.id}?academia=2`);

    const rows = await rowsOf(p.id);
    const byId = new Map(rows.map((r) => [r.id, r]));
    // Same difficulty, same unit: the prescription stays; the old cue goes.
    expect(byId.get(p.top)).toMatchObject({ exerciseId: ex["leg-press"], sets: 3, repMin: 3, repMax: 5, notes: null });
    expect(byId.get(p.backOff)).toMatchObject({ exerciseId: ex["leg-press"], sets: 2, repMin: 6, repMax: 10, notes: null });
    expect(byId.get(p.friday)).toMatchObject({ exerciseId: ex["goblet-squat"], repMin: 8, repMax: 12, notes: null });
    // Kept: untouched, note and all.
    expect(byId.get(p.extension)).toMatchObject({ exerciseId: ex["leg-extensions"], notes: "Segure 1 s em cima." });
    const after = await prisma.userProgram.findUniqueOrThrow({ where: { id: p.id }, select: { updatedAt: true } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
  });

  it("scales the range for a harder stand-in and takes the stand-in's own range across reps ↔ seconds", async () => {
    const p = await seedProgram(OWNER);
    await redirectOf(
      applyGymStandIns(
        p.id,
        form({
          // Hack (beginner) → front squat (advanced): the bottom of 8–12.
          [`swap:${ex["hack-squat"]}:${p.friday}`]: ex["front-barbell-squat"],
          // A rep exercise → a hold: never an "8–12 s" plank.
          [`swap:${ex["leg-extensions"]}:${p.extension}`]: ex["plank"],
        }),
      ),
    );
    const byId = new Map((await rowsOf(p.id)).map((r) => [r.id, r]));
    expect(byId.get(p.friday)).toMatchObject({ exerciseId: ex["front-barbell-squat"], repMin: 8, repMax: 8 });
    expect(byId.get(p.extension)).toMatchObject({ exerciseId: ex["plank"], repMin: 20, repMax: 45, sets: 3 });
  });

  it("keeping everything writes nothing", async () => {
    const p = await seedProgram(OWNER);
    const before = await rowsOf(p.id);
    const url = await redirectOf(
      applyGymStandIns(
        p.id,
        form({
          [`swap:${ex["hack-squat"]}:${p.top},${p.backOff}`]: "keep",
          [`swap:${ex["hack-squat"]}:${p.friday}`]: ex["hack-squat"],
        }),
      ),
    );
    expect(url).toBe(`/app/programs/${p.id}?academia=0`);
    expect(await rowsOf(p.id)).toEqual(before);
    const after = await prisma.userProgram.findUniqueOrThrow({ where: { id: p.id }, select: { updatedAt: true } });
    expect(after.updatedAt.getTime()).toBe(p.updatedAt.getTime());
  });

  it("refuses a stand-in the gym can't do — the whole review, nothing saved", async () => {
    const p = await seedProgram(OWNER);
    const before = await rowsOf(p.id);
    const review = `/app/programs/${p.id}/academia?mudou=1`;
    // The leg press marked missing since the review was opened; the other pick is fine but waits too.
    await prisma.profile.update({ where: { userId: OWNER }, data: { missingGear: ["hack-squat", "leg-press"] } });
    expect(
      await redirectOf(
        applyGymStandIns(
          p.id,
          form({
            [`swap:${ex["hack-squat"]}:${p.top},${p.backOff}`]: ex["goblet-squat"],
            [`swap:${ex["hack-squat"]}:${p.friday}`]: ex["leg-press"],
          }),
        ),
      ),
    ).toBe(review);
    // Not an exercise at all.
    expect(await redirectOf(applyGymStandIns(p.id, form({ [`swap:${ex["hack-squat"]}:${p.friday}`]: "no-such-exercise" })))).toBe(review);
    // A machine for someone who trains with dumbbells at home.
    await prisma.profile.update({ where: { userId: OWNER }, data: { equipmentAccess: "HOME_DUMBBELLS", missingGear: [] } });
    expect(
      await redirectOf(applyGymStandIns(p.id, form({ [`swap:${ex["hack-squat"]}:${p.friday}`]: ex["smith-machine-squat"] }))),
    ).toBe(review);
    expect(await rowsOf(p.id)).toEqual(before);
  });

  it("never touches someone else's program or rows", async () => {
    const mine = await seedProgram(OWNER);
    const theirs = await seedProgram(OTHER);
    const theirsBefore = await rowsOf(theirs.id);
    const mineBefore = await rowsOf(mine.id);
    // Their program, by id: not found for this user.
    expect(
      await redirectOf(applyGymStandIns(theirs.id, form({ [`swap:${ex["hack-squat"]}:${theirs.friday}`]: ex["leg-press"] }))),
    ).toBe("/app/programs");
    // Their row smuggled into a review of my program.
    expect(
      await redirectOf(applyGymStandIns(mine.id, form({ [`swap:${ex["hack-squat"]}:${theirs.friday}`]: ex["leg-press"] }))),
    ).toBe(`/app/programs/${mine.id}/academia?mudou=1`);
    expect(await rowsOf(theirs.id)).toEqual(theirsBefore);
    expect(await rowsOf(mine.id)).toEqual(mineBefore);
  });

  it("sends a review that no longer matches the program back to it, saving nothing", async () => {
    const p = await seedProgram(OWNER);
    const other = await seedProgram(OWNER);
    const review = `/app/programs/${p.id}/academia?mudou=1`;
    const send = (fields: Record<string, string>) => redirectOf(applyGymStandIns(p.id, form(fields)));
    // A row of another of the user's programs.
    expect(await send({ [`swap:${ex["hack-squat"]}:${other.friday}`]: ex["leg-press"] })).toBe(review);
    // A row named twice.
    expect(
      await send({
        [`swap:${ex["hack-squat"]}:${p.top},${p.backOff}`]: ex["leg-press"],
        [`swap:${ex["hack-squat"]}:${p.top}`]: ex["goblet-squat"],
      }),
    ).toBe(review);
    // Rows of two days in one field.
    expect(await send({ [`swap:${ex["hack-squat"]}:${p.top},${p.friday}`]: ex["leg-press"] })).toBe(review);
    // Not a field the review writes.
    expect(await send({ [`swap:${p.friday}`]: ex["leg-press"] })).toBe(review);
    // The row was changed to another exercise since (a builder save, "Usar no programa").
    await prisma.userProgramExercise.update({ where: { id: p.friday }, data: { exerciseId: ex["leg-extensions"] } });
    const before = await rowsOf(p.id);
    expect(await send({ [`swap:${ex["hack-squat"]}:${p.friday}`]: ex["leg-press"] })).toBe(review);
    expect(await rowsOf(p.id)).toEqual(before);
  });

  it("says the session is gone instead of saving", async () => {
    const p = await seedProgram(OWNER);
    const before = await rowsOf(p.id);
    auth.userId = null;
    expect(await applyGymStandIns(p.id, form({ [`swap:${ex["hack-squat"]}:${p.friday}`]: ex["leg-press"] }))).toEqual({
      ok: false,
      error: SESSION_EXPIRED_ERROR,
    });
    expect(await rowsOf(p.id)).toEqual(before);
  });
});
