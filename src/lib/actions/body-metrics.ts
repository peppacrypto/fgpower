"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/actions/result";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { zonedMidnight } from "@/lib/training/week";
import { checkBodyValue, type BodyKind } from "@/lib/training/body-weight";

/**
 * Logging weight and circumferences (W-083) — the owner's own data, never
 * shown to anyone else. One row per kind and São Paulo day: logging the same
 * kind twice on a day keeps the latest value (a check-in's weigh-in included).
 */

const DAY_MS = 86_400_000;
/** How far back an entry can be dated (a year and a day). */
const MAX_BACKDATE_DAYS = 366;

/** A save's result: `field` names the kind whose value is off. */
export type BodyMetricsSaveResult = { ok: true; savedAt: string } | { ok: false; error: string; field?: string };

export interface BodyMetricsInput {
  /** "YYYY-MM-DD" on the São Paulo calendar; today when absent. */
  date?: string | null;
  /** The values typed (blank fields are simply not sent: saving never deletes). */
  entries: { kind: string; value: number }[];
}

function revalidateBody() {
  revalidatePath("/app/progress");
  revalidatePath("/app/progress/body");
  revalidatePath("/app/today");
}

/** "2026-09-28" → its São Paulo day number, or null when it isn't a real date. */
function dayOfDate(date: string): { day: number; y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { day: Math.floor(utc / DAY_MS), y, m: mo, d };
}

/**
 * Saves weigh-ins and measurements for one day (today by default; back-dated
 * up to a year, never in the future). Each kind is upserted on (user, kind,
 * day): the latest value wins, and a value typed here replaces the one a
 * check-in wrote that day (no longer the workout's).
 */
export async function saveBodyMetrics(input: BodyMetricsInput): Promise<BodyMetricsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  const now = new Date();
  const todayNo = dayNumberOf(now);
  let day = todayNo;
  let measuredAt = now;
  if (typeof input?.date === "string" && input.date !== "") {
    const parsed = dayOfDate(input.date);
    if (!parsed) return { ok: false, error: "Confira a data.", field: "date" };
    if (parsed.day > todayNo) return { ok: false, error: "A data não pode ser no futuro.", field: "date" };
    if (parsed.day < todayNo - MAX_BACKDATE_DAYS) return { ok: false, error: "Use uma data do último ano.", field: "date" };
    day = parsed.day;
    // A past day is dated at its noon (São Paulo): it sorts inside that day wherever it's read.
    if (day !== todayNo) measuredAt = new Date(zonedMidnight(parsed.y, parsed.m - 1, parsed.d).getTime() + 12 * 3_600_000);
  }

  const entries = Array.isArray(input?.entries) ? input.entries.slice(0, 10) : [];
  if (entries.length === 0) return { ok: false, error: "Preencha ao menos um valor." };
  const seen = new Set<string>();
  const rows: { kind: BodyKind; value: number; unit: "kg" | "cm" }[] = [];
  for (const e of entries) {
    const kind = typeof e?.kind === "string" ? e.kind : "";
    const checked = checkBodyValue(kind, e?.value);
    if (!checked.ok) return { ok: false, error: checked.error, field: kind || undefined };
    if (seen.has(kind)) return { ok: false, error: "Confira os valores." };
    seen.add(kind);
    rows.push({ kind: kind as BodyKind, value: checked.value, unit: checked.unit });
  }

  await prisma.$transaction(
    rows.map((r) =>
      prisma.bodyMetric.upsert({
        where: { userId_kind_day: { userId: user.id, kind: r.kind, day } },
        create: { userId: user.id, kind: r.kind, value: r.value, unit: r.unit, day, measuredAt },
        update: { value: r.value, unit: r.unit, measuredAt, sessionId: null },
      }),
    ),
  );
  revalidateBody();
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Deletes one of the user's entries (someone else's id deletes nothing). */
export async function deleteBodyMetric(id: string): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof id !== "string" || id === "" || id.length > 64) return { ok: false, error: "Registro não encontrado." };
  await prisma.bodyMetric.deleteMany({ where: { id, userId: user.id } });
  revalidateBody();
  return { ok: true };
}
