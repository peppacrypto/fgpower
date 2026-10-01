import * as z from "zod";
import { isPushHour, type PushHour } from "./rules";

/**
 * The Settings → Lembretes block as the client sends it (autosaved whole,
 * validated strictly: nothing else reaches Prisma). Pure, client-safe.
 */
export const reminderSettingsSchema = z
  .object({
    hour: z.number().int().refine(isPushHour),
    emailDigest: z.boolean(),
  })
  .strict();

export interface ReminderSettings {
  hour: PushHour;
  emailDigest: boolean;
}

/** "18h" */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}h`;
}

const WEEKDAY_TAGS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/** "SEG · QUA · SEX", Monday first; null without a schedule. */
export function weekdaysLabel(days: ReadonlySet<number>): string | null {
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.has(d));
  return order.length > 0 ? order.map((d) => WEEKDAY_TAGS[d]).join(" · ") : null;
}
