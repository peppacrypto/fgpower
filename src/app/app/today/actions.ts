"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { WEEK_START_COOKIE, weekStartValue, type WeekStartPick } from "./week-start";

/**
 * "Continuar a sequência" / "Recomeçar" at the start of a week after one
 * stopped mid-plan: remembered for this week (a cookie on this device, no
 * program data changes — the day pointer stays as the last workout left it).
 */
export async function chooseWeekStart(enrollmentId: string, weekKey: string, pick: WeekStartPick) {
  if (!/^[\w-]{1,64}$/.test(enrollmentId) || !/^\d{1,6}$/.test(weekKey)) return;
  if (pick !== "continue" && pick !== "restart") return;
  (await cookies()).set(WEEK_START_COOKIE, weekStartValue(enrollmentId, weekKey, pick), {
    path: "/app",
    maxAge: 8 * 24 * 60 * 60,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/app/today");
}
