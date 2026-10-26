import "dotenv/config";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GEAR, exerciseGear } from "@/lib/exercises/gear";
import { blockedPlan } from "./gym-plan";

/**
 * Aparelhos' notice (Settings → Minha academia) against the real local
 * Postgres: the plan is read day by day, an exercise the gym can't do is
 * named once however many days prescribe it, one it can do — or that needs
 * nothing — never is, and someone else's program reads as nothing. What each
 * exercise needs comes from lib/exercises/gear, so the cases hold whatever the
 * curated gear map says.
 */

const RUN = `gymplan-${Date.now()}`;
const USER = `${RUN}-u`;
const OTHER = `${RUN}-o`;
const LISTED = new Set<string>(GEAR.filter((g) => g.listed).map((g) => g.id));

type Ex = { id: string; slug: string; namePt: string; equipmentId: string | null; category: string };
let candidates: Ex[] = [];
let blocked: Ex;
let missing: string[] = [];
let programId = "";
let otherProgramId = "";

/** Only gear a user can mark in Settings: untick it all and the exercise can't be done. */
const markable = (e: Ex) => exerciseGear(e).length > 0 && exerciseGear(e).every((id) => LISTED.has(id));

async function program(userId: string, days: { dayIndex: number; exercises: Ex[] }[]) {
  const created = await prisma.userProgram.create({
    data: {
      userId,
      name: "Plano de teste",
      status: "ACTIVE",
      daysPerWeek: days.length,
      days: {
        create: days.map((d) => ({
          dayIndex: d.dayIndex,
          name: `Dia ${d.dayIndex + 1}`,
          exercises: { create: d.exercises.map((e, i) => ({ exerciseId: e.id, sortOrder: i })) },
        })),
      },
    },
    select: { id: true },
  });
  return created.id;
}

beforeAll(async () => {
  for (const id of [USER, OTHER]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  }
  candidates = await prisma.exercise.findMany({
    where: { isPublished: true, category: { not: "STRETCHING" } },
    select: { id: true, slug: true, namePt: true, equipmentId: true, category: true },
    orderBy: { slug: "asc" },
  });
  blocked = candidates.find(markable)!;
  missing = [...exerciseGear(blocked)];
  const free = candidates.find((e) => exerciseGear(e).length === 0)!;
  const doable = candidates.find((e) => exerciseGear(e).some((id) => !missing.includes(id)))!;
  // On both days: still one exercise. The one needing nothing, the one doable another way: never.
  programId = await program(USER, [
    { dayIndex: 0, exercises: [free, blocked] },
    { dayIndex: 1, exercises: [doable, blocked] },
  ]);
  otherProgramId = await program(OTHER, [{ dayIndex: 0, exercises: [blocked] }]);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER, OTHER] } } });
  await prisma.$disconnect();
});

it("names the exercise the gym can't do once, and links to the plan's adjustment", async () => {
  expect(await blockedPlan(USER, programId, missing)).toEqual({
    href: `/app/programs/${programId}/academia`,
    count: 1,
    names: blocked.namePt,
  });
});

it("says nothing while the gym lacks nothing, or without an active plan", async () => {
  expect(await blockedPlan(USER, programId, [])).toBeNull();
  expect(await blockedPlan(USER, null, missing)).toBeNull();
});

it("reads someone else's program as nothing, whatever id it is given", async () => {
  expect(await blockedPlan(USER, otherProgramId, missing)).toBeNull();
  expect(await blockedPlan(OTHER, otherProgramId, missing)).toMatchObject({ count: 1 });
});

it("names them day by day in the plan's order — the first three, then a count", async () => {
  const [e1, e2, e3, e4, e5] = candidates.filter(markable).slice(0, 5);
  // Day 2 written first: the order is the plan's (day, then place), not the rows'.
  const id = await program(USER, [
    { dayIndex: 1, exercises: [e1, e3] },
    { dayIndex: 0, exercises: [e2, e4, e5] },
  ]);
  const everything = [...LISTED];
  expect(await blockedPlan(USER, id, everything)).toEqual({
    href: `/app/programs/${id}/academia`,
    count: 5,
    names: `${e2.namePt}, ${e4.namePt}, ${e5.namePt} e mais 2`,
  });
});
