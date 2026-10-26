import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getAlternatives against the real seeded catalog, judged by the gym's gear
 * (Settings → Minha academia: Profile.missingGear). The curated gear map is
 * stubbed so each test decides which apparatus an exercise needs — anything
 * it doesn't list falls back to its catalog tag (dumbbell → "dumbbells") — and
 * the content pass that curates the real map can change without moving these.
 */
const { gearMap } = vi.hoisted(() => ({ gearMap: {} as Record<string, readonly [readonly string[], string]> }));
vi.mock("@/lib/exercises/gear-map.generated", () => ({ GEAR_MAP: gearMap }));

const { prisma } = await import("@/lib/db");
const { EQUIPMENT_FOR_ACCESS, getAlternatives } = await import("./alternatives");
const { isDoable } = await import("@/lib/exercises/gear");

async function idOf(slug: string): Promise<string> {
  return (await prisma.exercise.findUniqueOrThrow({ where: { slug }, select: { id: true } })).id;
}

beforeEach(() => {
  for (const slug of Object.keys(gearMap)) delete gearMap[slug];
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getAlternatives and the gym's gear", () => {
  it("drops a curated alternative the gym can't do, keeping the curated ones first, in order", async () => {
    const hack = await idOf("hack-squat");
    const open = await getAlternatives(hack, { limit: 6 });
    // The seeded relations: the leg press is the Hack's first alternative.
    expect(open[0]).toMatchObject({ slug: "leg-press", reason: "ALTERNATIVE" });

    gearMap["leg-press"] = [["leg-press"], "PLATE_MACHINE"];
    const out = await getAlternatives(hack, { limit: 6, missingGear: ["leg-press"] });
    expect(out.map((a) => a.slug)).not.toContain("leg-press");
    // The rest move up a place; the list is still full.
    expect(out.slice(0, 5).map((a) => a.id)).toEqual(open.slice(1).map((a) => a.id));
    expect(out).toHaveLength(6);
  });

  it("reads past the pages the gym can't do until the list is full, in the same order", async () => {
    const hack = await idOf("hack-squat");
    // Every one of the first 30 stand-ins turns out to need a Hack — which the gym lacks.
    const first30 = await getAlternatives(hack, { limit: 30 });
    expect(first30).toHaveLength(30);
    for (const a of first30) gearMap[a.slug] = [["hack-squat"], "PLATE_MACHINE"];
    const blocked = new Set(first30.map((a) => a.id));
    const everything = await getAlternatives(hack, { limit: 80 });
    const expected = everything.filter((a) => !blocked.has(a.id)).slice(0, 6);
    expect(expected.length, "the catalog holds stand-ins past the first 30").toBe(6);

    const out = await getAlternatives(hack, { limit: 6, missingGear: ["hack-squat"] });
    expect(out.map((a) => a.id)).toEqual(expected.map((a) => a.id));
    for (const a of out) expect(isDoable(a, ["hack-squat"])).toBe(true);
  });

  it("keeps the access level's filter alongside the gym's", async () => {
    const squat = await idOf("barbell-squat");
    // At home with dumbbells — but the dumbbells marked missing: bench and bodyweight only.
    const out = await getAlternatives(squat, { equipmentAccess: "HOME_DUMBBELLS", missingGear: ["dumbbells"], limit: 8 });
    expect(out.length).toBeGreaterThan(0);
    for (const a of out) {
      expect(EQUIPMENT_FOR_ACCESS.HOME_DUMBBELLS).toContain(a.equipmentId);
      expect(a.equipmentId).not.toBe("dumbbell");
    }
  });

  it("changes nothing while the gym lacks nothing the stand-ins use", async () => {
    const hack = await idOf("hack-squat");
    const ids = async (missingGear?: string[]) => (await getAlternatives(hack, { limit: 10, missingGear })).map((a) => a.id);
    const plain = await ids();
    expect(await ids([])).toEqual(plain);
    expect(await ids(["sled", "rower"])).toEqual(plain);
  });
});
