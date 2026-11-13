"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/prisma-error";
import { getDietPlan } from "@/lib/data/diet";
import { dayOfIso, isMarkableDay } from "@/lib/diet/days";
import { findItem, optionOf, type DietItem, type DietMeal } from "@/lib/diet/plan";
import { dayNumberOf } from "@/lib/training/day-rotation";

/**
 * Dieta's marks: which items of the plan were eaten on a São Paulo day, and
 * which option filled each — the owner's own health data. The client sends
 * the state it wants for each item and day, never a toggle, so a retry or a
 * duplicate from a flaky connection lands on the same row with the same
 * values. Only the item's id and the choice come from the client: the food and
 * its numbers are copied from the caller's own plan.
 */

export interface DietMarkInput {
  /** "YYYY-MM-DD" on the São Paulo calendar. */
  date: string;
  itemId: string;
  eaten: boolean;
  /** The alternative picked; null = the item itself. */
  choiceId: string | null;
}

/**
 * `skipped`: marks not kept — an item or a choice the plan doesn't have (it
 * changed since the page loaded), or a day ahead of today or over a year back.
 * `permanent`: sending the same again fails the same way (no plan, a bad batch).
 */
export type DietSaveResult = { ok: true; savedAt: string; skipped: number } | { ok: false; error: string; permanent?: boolean };

/** Marks one call takes (the screen sends what it holds, in batches of up to this). */
const MAX_MARKS = 100;

interface CheckedMark {
  day: number;
  meal: DietMeal;
  item: DietItem;
  eaten: boolean;
  choiceId: string | null;
}

/** A mark as sent, checked against the plan and the calendar; null when it can't be kept. */
function checkMark(raw: unknown, meals: readonly DietMeal[], todayNo: number): CheckedMark | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const day = dayOfIso(m.date);
  if (day == null || !isMarkableDay(day, todayNo)) return null;
  if (typeof m.itemId !== "string" || typeof m.eaten !== "boolean") return null;
  const found = findItem(meals, m.itemId);
  if (!found) return null;
  // The item's own id as the choice is the item itself.
  const choiceId = m.choiceId == null || m.choiceId === found.item.id ? null : m.choiceId;
  if (choiceId !== null && (typeof choiceId !== "string" || !found.item.alternatives?.some((a) => a.id === choiceId))) return null;
  return { day, meal: found.meal, item: found.item, eaten: m.eaten, choiceId };
}

/**
 * Sets items' marks for their days. Each (item, day) keeps one row while it
 * says something — eaten, or an alternative picked — with the option's food
 * and numbers copied in; an item back to "not eaten, the item itself" has its
 * row deleted. The same item twice in one call: the last one wins.
 */
export async function saveDietMarks(input: { marks: DietMarkInput[] }): Promise<DietSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  const marks: unknown = input?.marks;
  if (!Array.isArray(marks) || marks.length === 0 || marks.length > MAX_MARKS) {
    return { ok: false, error: "Confira as marcações.", permanent: true };
  }
  const plan = await getDietPlan(user.id);
  if (!plan) return { ok: false, error: "Você ainda não tem um plano alimentar.", permanent: true };

  const todayNo = dayNumberOf(new Date());
  const rows = new Map<string, CheckedMark>();
  let skipped = 0;
  for (const raw of marks) {
    const mark = checkMark(raw, plan.meals, todayNo);
    if (!mark) {
      skipped += 1;
      continue;
    }
    const key = `${mark.day}|${mark.item.id}`;
    rows.delete(key); // re-inserted: the last one wins
    rows.set(key, mark);
  }

  const writes = () =>
    [...rows.values()].map((r) => {
      if (!r.eaten && r.choiceId === null) {
        return prisma.dietLog.deleteMany({ where: { userId: user.id, day: r.day, itemId: r.item.id } });
      }
      const option = optionOf(r.item, r.choiceId);
      const data = {
        eaten: r.eaten,
        choiceId: r.choiceId,
        meal: r.meal.name,
        food: option.food,
        amount: option.amount,
        kcal: option.kcal,
        protein: option.protein,
        carbs: option.carbs,
        fat: option.fat,
      };
      return prisma.dietLog.upsert({
        where: { userId_day_itemId: { userId: user.id, day: r.day, itemId: r.item.id } },
        create: { userId: user.id, day: r.day, itemId: r.item.id, ...data },
        update: data,
      });
    });

  if (rows.size > 0) {
    try {
      await prisma.$transaction(writes());
    } catch (err) {
      // Another device wrote the same row first: once more, as an update of it.
      const retried = isUniqueViolation(err) ? await prisma.$transaction(writes()).then(() => true, () => false) : false;
      if (!retried) {
        console.error("saveDietMarks failed", err);
        return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
      }
    }
    // Perfil's "Dieta de hoje" card (and a page left with the back button) shows the new count.
    revalidatePath("/app/profile");
  }
  return { ok: true, savedAt: new Date().toISOString(), skipped };
}
