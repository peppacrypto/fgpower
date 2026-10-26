import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The workout's "Trocar" / "Adicionar exercício" sheet (getExerciseOptions)
 * against the real catalog, with the gym's gear (Profile.missingGear): the
 * stand-ins, the search and the first picks never offer an exercise the gym
 * can't do — not even the program's own to swap back to — and each option
 * names its apparatus (gearPt). The curated gear map is stubbed so the gear
 * each exercise needs is the test's own, whatever the content pass does.
 */
const { gearMap } = vi.hoisted(() => ({ gearMap: {} as Record<string, readonly [readonly string[], string]> }));
vi.mock("@/lib/exercises/gear-map.generated", () => ({ GEAR_MAP: gearMap }));

const { prisma } = await import("@/lib/db");
const { getExerciseOptions } = await import("./workout-session");

const USER = `xopts-${Date.now()}`;
const ex: Record<string, string> = {};
let sessionId = "";
let hackLog = "";
let swappedLog = "";

const setMissing = (missingGear: string[]) => prisma.profile.update({ where: { userId: USER }, data: { missingGear } });

beforeAll(async () => {
  for (const slug of ["hack-squat", "leg-press", "goblet-squat"]) {
    ex[slug] = (await prisma.exercise.findUniqueOrThrow({ where: { slug }, select: { id: true } })).id;
  }
  await prisma.user.create({ data: { id: USER, name: USER, email: `${USER}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: USER, displayName: USER } });
  const session = await prisma.workoutSession.create({ data: { userId: USER, name: "Inferior", status: "IN_PROGRESS" } });
  sessionId = session.id;
  const log = (exerciseId: string, sortOrder: number, substitutedFromExerciseId: string | null = null) =>
    prisma.workoutExerciseLog.create({
      data: { sessionId, userId: USER, exerciseId, sortOrder, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 120, substitutedFromExerciseId },
      select: { id: true },
    });
  hackLog = (await log(ex["hack-squat"], 0)).id;
  // The leg press, swapped earlier for the goblet squat (the program's own, to swap back to).
  swappedLog = (await log(ex["goblet-squat"], 1, ex["leg-press"])).id;
});

beforeEach(async () => {
  for (const slug of Object.keys(gearMap)) delete gearMap[slug];
  gearMap["hack-squat"] = [["hack-squat"], "PLATE_MACHINE"];
  gearMap["leg-press"] = [["leg-press"], "PLATE_MACHINE"];
  gearMap["smith-machine-squat"] = [["smith"], "BARBELL"];
  await setMissing([]);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

describe("getExerciseOptions and the gym's gear", () => {
  it("never offers a stand-in the gym can't do, and names each one's apparatus", async () => {
    const open = await getExerciseOptions(USER, { sessionId, exerciseLogId: hackLog });
    expect(open?.options.map((o) => o.slug)).toContain("leg-press");
    expect(open?.options.find((o) => o.slug === "leg-press")?.gearPt).toBe("Leg press");
    // Judged by its catalog tag when the map doesn't list it: a dumbbell squat takes the dumbbells.
    const dumbbell = open?.options.find((o) => o.slug === "goblet-squat" || o.equipment === "Halteres");
    if (dumbbell) expect(dumbbell.gearPt).toBe("Halteres");

    await setMissing(["leg-press"]);
    const gym = await getExerciseOptions(USER, { sessionId, exerciseLogId: hackLog });
    expect(gym?.options.map((o) => o.slug)).not.toContain("leg-press");
    // Still a full list: the next stand-ins fill the place.
    expect(gym?.options.length).toBe(open?.options.length);
    for (const o of gym?.options ?? []) expect(o).toHaveProperty("gearPt");
  });

  it("doesn't offer to swap back to the program's own when the gym lacks it", async () => {
    const open = await getExerciseOptions(USER, { sessionId, exerciseLogId: swappedLog });
    expect(open?.options[0]).toMatchObject({ slug: "leg-press", reason: "ORIGINAL", gearPt: "Leg press" });

    await setMissing(["leg-press"]);
    const gym = await getExerciseOptions(USER, { sessionId, exerciseLogId: swappedLog });
    expect(gym?.options.some((o) => o.reason === "ORIGINAL" || o.slug === "leg-press")).toBe(false);
  });

  it("leaves what the gym can't do out of a search and of the first picks", async () => {
    const search = async () => (await getExerciseOptions(USER, { sessionId, q: "leg press" }))?.options.map((o) => o.slug) ?? [];
    expect(await search()).toContain("leg-press");
    const picks = async () => (await getExerciseOptions(USER, { sessionId }))?.options ?? [];
    const firstPicks = await picks();
    expect(firstPicks.length).toBeGreaterThan(1);
    // The first pick turns out to need a sled — which this gym doesn't have.
    const top = firstPicks[0];
    gearMap[top.slug] = [["sled"], "NONE"];

    await setMissing(["leg-press", "sled"]);
    expect(await search()).not.toContain("leg-press");
    const gymPicks = await picks();
    expect(gymPicks.map((o) => o.id)).not.toContain(top.id);
    // The next ones move up, and the list stays full (it reads past the first page to).
    expect(gymPicks[0].id).toBe(firstPicks[1].id);
    expect(gymPicks.length).toBeGreaterThanOrEqual(firstPicks.length);
    expect(gymPicks.length).toBeLessThanOrEqual(20);
  });
});
