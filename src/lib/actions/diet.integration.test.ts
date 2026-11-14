import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { getDietGlance, getDietMarks, getDietPlan } from "@/lib/data/diet";
import { DIET_BACKDATE_DAYS, isoOfDay } from "@/lib/diet/days";
import { saveDietPlan } from "@/lib/diet/save-plan";
import { dayNumberOf } from "@/lib/training/day-rotation";
import testPlan from "@/lib/diet/test-plan.json";

/**
 * Dieta's marks against the real local Postgres: each (item, São Paulo day)
 * keeps one row with the option it logged, set — never toggled — so a retried
 * or doubled call changes nothing; days ahead or over a year back are not
 * kept; and every read and write is the caller's own: someone else's item ids
 * write nothing of theirs, and nobody reads another account's plan or marks.
 */

const RUN_ID = `diet-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const OTHER_ID = `${RUN_ID}-o`;
let signedIn: string | null = USER_ID;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!signedIn) throw new Error("UNAUTHORIZED");
    return { id: signedIn };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { saveDietMarks } = await import("./diet");

const today = () => dayNumberOf(new Date());
const mark = (itemId: string, eaten: boolean, choiceId: string | null = null, day = today()) => ({
  date: isoOfDay(day),
  itemId,
  eaten,
  choiceId,
});
const rowsOf = (userId: string) =>
  prisma.dietLog.findMany({ where: { userId }, orderBy: [{ day: "asc" }, { itemId: "asc" }] });

/** Another plan for the other account: its own ids, one of them the same as the test plan's. */
const otherPlan = {
  title: "Outro plano",
  targets: { kcal: 2500, protein: 180, carbs: 300, fat: 70 },
  meals: [
    {
      id: "o1",
      name: "Jantar",
      items: [
        { id: "o1-macarrao", food: "Macarrão", amount: "200 g", kcal: 300, protein: 10, carbs: 60, fat: 2 },
        { id: "cafe-pao", food: "Pão de queijo", amount: "3 unidades", kcal: 250, protein: 5, carbs: 30, fat: 12 },
      ],
    },
  ],
};

beforeAll(async () => {
  for (const id of [USER_ID, OTHER_ID]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  }
  await saveDietPlan(USER_ID, testPlan);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_ID] } } });
  await prisma.$disconnect();
});

describe("saveDietMarks", () => {
  it("marks an item eaten, idempotently: a retried or doubled call leaves the same single row", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await saveDietMarks({ marks: [mark("cafe-pao", true)] })).toMatchObject({ ok: true, skipped: 0 });
    }
    const rows = await rowsOf(USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      day: today(),
      itemId: "cafe-pao",
      eaten: true,
      choiceId: null,
      meal: "Café",
      food: "Pão integral",
      amount: "2 fatias",
      kcal: 120,
      protein: 6,
    });
    expect(await getDietMarks(USER_ID, today())).toEqual({ "cafe-pao": { eaten: true, choiceId: null, counts: null } });
  });

  it("unchecks idempotently: the row goes, and going again changes nothing", async () => {
    expect(await saveDietMarks({ marks: [mark("cafe-pao", false)] })).toMatchObject({ ok: true, skipped: 0 });
    expect(await saveDietMarks({ marks: [mark("cafe-pao", false)] })).toMatchObject({ ok: true, skipped: 0 });
    expect(await rowsOf(USER_ID)).toHaveLength(0);
    expect(await getDietMarks(USER_ID, today())).toEqual({});
  });

  it("logs the alternative's food and numbers, keeps the choice while not eaten, and forgets it back on the item itself", async () => {
    await saveDietMarks({ marks: [mark("almoco-tilapia", true, "almoco-atum")] });
    let [row] = await rowsOf(USER_ID);
    expect(row).toMatchObject({ itemId: "almoco-tilapia", choiceId: "almoco-atum", eaten: true, food: "Atum em lata, escorrido", kcal: 140, protein: 31 });

    // Not eaten after all, the sardines still picked: the row says so.
    await saveDietMarks({ marks: [mark("almoco-tilapia", false, "almoco-atum")] });
    [row] = await rowsOf(USER_ID);
    expect(row).toMatchObject({ eaten: false, choiceId: "almoco-atum" });

    // The item itself, eaten: its own numbers. Then neither eaten nor an alternative: no row.
    await saveDietMarks({ marks: [mark("almoco-tilapia", true, "almoco-tilapia")] });
    [row] = await rowsOf(USER_ID);
    expect(row).toMatchObject({ eaten: true, choiceId: null, food: "Filé de tilápia grelhado", kcal: 190 });
    await saveDietMarks({ marks: [mark("almoco-tilapia", false)] });
    expect(await rowsOf(USER_ID)).toHaveLength(0);
  });

  it("counts an item's pieces: their sum and words logged, the counts kept — the plan's own counts keep nothing", async () => {
    const COM = "cafe-ovos--com-gema";
    const SEM = "cafe-ovos--sem-gema";
    const eggs = (eaten: boolean, counts: Record<string, number> | null) => ({ ...mark("cafe-ovos", eaten), counts });

    // Three whole eggs and one white.
    expect(await saveDietMarks({ marks: [eggs(true, { [COM]: 3, [SEM]: 1 })] })).toMatchObject({ ok: true, skipped: 0 });
    let [row] = await rowsOf(USER_ID);
    expect(row).toMatchObject({
      itemId: "cafe-ovos",
      eaten: true,
      choiceId: null,
      counts: { [COM]: 3, [SEM]: 1 },
      food: "Ovos mexidos",
      amount: "4 ovos: 3 com gema, 1 sem gema",
      kcal: 242,
      protein: 22.35,
      carbs: 1.7,
      fat: 15,
    });
    expect(await getDietMarks(USER_ID, today())).toEqual({ "cafe-ovos": { eaten: true, choiceId: null, counts: { [COM]: 3, [SEM]: 1 } } });
    expect(await getDietGlance(USER_ID)).toMatchObject({ eaten: 1, kcal: 242 });

    // Back at the plan's two whole eggs: the item itself, no counts of its own.
    await saveDietMarks({ marks: [eggs(true, { [COM]: 2, [SEM]: 0 })] });
    [row] = await rowsOf(USER_ID);
    expect(row).toMatchObject({ eaten: true, counts: null, amount: "2 ovos com gema", kcal: 150 });

    // No egg at all is nothing eaten, whatever was sent; the counts still say so.
    await saveDietMarks({ marks: [eggs(true, { [COM]: 0, [SEM]: 0 })] });
    [row] = await rowsOf(USER_ID);
    expect(row).toMatchObject({ eaten: false, counts: { [COM]: 0, [SEM]: 0 }, amount: "0 ovos", kcal: 0 });

    // Not eaten, as planned: no row.
    await saveDietMarks({ marks: [eggs(false, null)] });
    expect(await rowsOf(USER_ID)).toHaveLength(0);
  });

  it("skips counts the item can't take: a kind it doesn't have, a number that isn't whole or is too big, an item without pieces", async () => {
    const result = await saveDietMarks({
      marks: [
        { ...mark("cafe-ovos", true), counts: { gema: 2 } },
        { ...mark("cafe-ovos", true), counts: { "cafe-ovos--com-gema": 2.5 } },
        { ...mark("cafe-ovos", true), counts: { "cafe-ovos--com-gema": 21 } },
        { ...mark("cafe-pao", true), counts: { "cafe-ovos--com-gema": 1 } },
      ],
    });
    expect(result).toMatchObject({ ok: true, skipped: 4 });
    expect(await rowsOf(USER_ID)).toHaveLength(0);
  });

  it("takes a batch: the same item twice in one call keeps the last", async () => {
    const result = await saveDietMarks({
      marks: [mark("cafe-ovos", true), mark("lanche-iogurte", true), mark("cafe-ovos", false)],
    });
    expect(result).toMatchObject({ ok: true, skipped: 0 });
    expect((await rowsOf(USER_ID)).map((r) => [r.itemId, r.eaten])).toEqual([["lanche-iogurte", true]]);
    await saveDietMarks({ marks: [mark("lanche-iogurte", false)] });
  });

  it("keeps each São Paulo day apart, up to a year back; a day ahead or older isn't kept", async () => {
    const t = today();
    const result = await saveDietMarks({
      marks: [
        mark("cafe-pao", true, null, t),
        mark("cafe-pao", true, null, t - 1),
        mark("cafe-pao", true, null, t - DIET_BACKDATE_DAYS),
        mark("cafe-pao", true, null, t + 1),
        mark("cafe-pao", true, null, t - DIET_BACKDATE_DAYS - 1),
        { date: "2026-02-30", itemId: "cafe-pao", eaten: true, choiceId: null },
      ],
    });
    expect(result).toMatchObject({ ok: true, skipped: 3 });
    expect((await rowsOf(USER_ID)).map((r) => r.day)).toEqual([t - DIET_BACKDATE_DAYS, t - 1, t]);
    // Unmarking yesterday leaves today alone.
    await saveDietMarks({ marks: [mark("cafe-pao", false, null, t - 1)] });
    expect(await getDietMarks(USER_ID, t - 1)).toEqual({});
    expect(await getDietMarks(USER_ID, t)).toEqual({ "cafe-pao": { eaten: true, choiceId: null, counts: null } });
    await saveDietMarks({ marks: [mark("cafe-pao", false, null, t), mark("cafe-pao", false, null, t - DIET_BACKDATE_DAYS)] });
    expect(await rowsOf(USER_ID)).toHaveLength(0);
  });

  it("dates by the São Paulo calendar: at 23:30 on the 13th there, the 13th is today and the 14th (UTC's) is ahead", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-14T02:30:00Z"));
      const result = await saveDietMarks({
        marks: [
          { date: "2026-11-13", itemId: "lanche-iogurte", eaten: true, choiceId: null },
          { date: "2026-11-14", itemId: "lanche-iogurte", eaten: true, choiceId: null },
        ],
      });
      expect(result).toMatchObject({ ok: true, skipped: 1 });
    } finally {
      vi.useRealTimers();
    }
    const rows = await rowsOf(USER_ID);
    expect(rows.map((r) => isoOfDay(r.day))).toEqual(["2026-11-13"]);
    await prisma.dietLog.deleteMany({ where: { userId: USER_ID } });
  });

  it("skips an item or a choice the plan doesn't have (a plan changed since the page loaded)", async () => {
    const result = await saveDietMarks({
      marks: [mark("item-antigo", true), mark("almoco-tilapia", true, "almoco-sardinha"), mark("cafe-pao", "sim" as unknown as boolean)],
    });
    expect(result).toEqual({ ok: true, savedAt: expect.any(String), skipped: 3 });
    expect(await rowsOf(USER_ID)).toHaveLength(0);
  });

  it("refuses a bad batch and a signed-out caller, and says when there's no plan", async () => {
    for (const bad of [{ marks: [] }, { marks: "x" }, {}, { marks: Array.from({ length: 101 }, () => mark("cafe-pao", true)) }]) {
      expect(await saveDietMarks(bad as never)).toEqual({ ok: false, error: "Confira as marcações.", permanent: true });
    }
    signedIn = null;
    try {
      expect(await saveDietMarks({ marks: [mark("cafe-pao", true)] })).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    } finally {
      signedIn = USER_ID;
    }
    signedIn = OTHER_ID;
    try {
      expect(await saveDietMarks({ marks: [mark("cafe-pao", true)] })).toEqual({
        ok: false,
        error: "Você ainda não tem um plano alimentar.",
        permanent: true,
      });
    } finally {
      signedIn = USER_ID;
    }
    expect(await prisma.dietLog.count({ where: { userId: { in: [USER_ID, OTHER_ID] } } })).toBe(0);
  });
});

describe("another account", () => {
  it("cannot write someone's marks: the same item ids write only to the caller's own plan and rows", async () => {
    await saveDietMarks({ marks: [mark("cafe-pao", true), mark("cafe-ovos", true)] });
    await saveDietPlan(OTHER_ID, otherPlan);
    signedIn = OTHER_ID;
    try {
      // "cafe-ovos" is not in the other plan: skipped. "cafe-pao" is — as the other plan's own item.
      const result = await saveDietMarks({ marks: [mark("cafe-pao", false), mark("cafe-ovos", false), mark("cafe-pao", true)] });
      expect(result).toMatchObject({ ok: true, skipped: 1 });
    } finally {
      signedIn = USER_ID;
    }
    const mine = await rowsOf(USER_ID);
    expect(mine.map((r) => [r.itemId, r.eaten, r.food])).toEqual([
      ["cafe-ovos", true, "Ovos mexidos"],
      ["cafe-pao", true, "Pão integral"],
    ]);
    const theirs = await rowsOf(OTHER_ID);
    expect(theirs.map((r) => [r.itemId, r.eaten, r.food, r.meal])).toEqual([["cafe-pao", true, "Pão de queijo", "Jantar"]]);
  });

  it("cannot read someone's plan or marks: every read is the caller's own", async () => {
    expect((await getDietPlan(OTHER_ID))?.title).toBe("Outro plano");
    expect(await getDietMarks(OTHER_ID, today())).toEqual({ "cafe-pao": { eaten: true, choiceId: null, counts: null } });
    expect(await getDietMarks(USER_ID, today())).toEqual({
      "cafe-ovos": { eaten: true, choiceId: null, counts: null },
      "cafe-pao": { eaten: true, choiceId: null, counts: null },
    });
    // Perfil's card: today's count and kcal against each one's own plan.
    expect(await getDietGlance(USER_ID)).toEqual({ eaten: 2, items: 5, kcal: 270, kcalTarget: 1800 });
    expect(await getDietGlance(OTHER_ID)).toEqual({ eaten: 1, items: 2, kcal: 250, kcalTarget: 2500 });
  });
});

describe("a plan replaced, an account deleted", () => {
  it("replacing the plan keeps the days logged; marks the new plan lacks count for nothing", async () => {
    const changed = JSON.parse(JSON.stringify(testPlan));
    changed.meals[0].items = changed.meals[0].items.filter((i: { id: string }) => i.id !== "cafe-ovos");
    changed.title = "Plano de teste 2";
    await saveDietPlan(USER_ID, changed);
    expect(await prisma.dietPlan.count({ where: { userId: USER_ID } })).toBe(1);
    expect((await getDietPlan(USER_ID))?.title).toBe("Plano de teste 2");
    // The row stays as logged (the export has it); the day's numbers follow the plan as it is.
    expect(await prisma.dietLog.count({ where: { userId: USER_ID, itemId: "cafe-ovos" } })).toBe(1);
    expect(await getDietGlance(USER_ID)).toEqual({ eaten: 1, items: 4, kcal: 120, kcalTarget: 1800 });
    expect(await saveDietMarks({ marks: [mark("cafe-ovos", false)] })).toMatchObject({ ok: true, skipped: 1 });
  });

  it("refuses to store a plan the schema doesn't pass", async () => {
    await expect(saveDietPlan(USER_ID, { ...testPlan, meals: [] } as never)).rejects.toThrow();
    expect((await getDietPlan(USER_ID))?.title).toBe("Plano de teste 2");
  });

  it("deleting the account takes its plan and marks with it (LGPD erasure)", async () => {
    await prisma.user.delete({ where: { id: OTHER_ID } });
    expect(await prisma.dietPlan.count({ where: { userId: OTHER_ID } })).toBe(0);
    expect(await prisma.dietLog.count({ where: { userId: OTHER_ID } })).toBe(0);
    expect(await prisma.dietPlan.count({ where: { userId: USER_ID } })).toBe(1);
  });
});
