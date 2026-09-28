"use server";

import { revalidatePath } from "next/cache";
import { refreshSessionCache } from "@/lib/auth/refresh-session";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { findAvailableUsername, isUsernameTaken } from "@/lib/data/profile";
import { prisma } from "@/lib/db";
import {
  EQUIPMENT_ACCESS_OPTIONS,
  EXPERIENCE_LEVELS,
  TRAINING_GOALS,
} from "@/lib/validation/onboarding";
import { slugifyUsername, usernameError, USERNAME_TAKEN } from "@/lib/validation/username";
import { z } from "zod";
import { applyWeekLayout } from "@/lib/data/program-lifecycle";
import type { SettingsSaveResult } from "./result";

const GENERIC_ERROR = "Não foi possível salvar agora. Tente de novo.";

export type UsernameResult = { ok: true; username: string } | { ok: false; error: string };

export async function claimUsername(displayUsername: string): Promise<UsernameResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const value = String(displayUsername ?? "").trim();
  const invalid = usernameError(value);
  if (invalid) return { ok: false, error: invalid };
  const normalized = value.toLowerCase();

  if (await isUsernameTaken(normalized, user.id)) {
    return { ok: false, error: USERNAME_TAKEN };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { username: normalized, displayUsername: value },
    });
  } catch (err) {
    // Lost a race for the same name between the check above and the write.
    if ((err as { code?: string }).code === "P2002") return { ok: false, error: USERNAME_TAKEN };
    console.error("claimUsername failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  await refreshSessionCache();
  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
  return { ok: true, username: value };
}

/**
 * Onboarding's "@usuário" prefill: the first free handle derived from the
 * name being typed ("Maria" → "maria", or "maria2" when taken).
 */
export async function suggestUsername(displayName: string): Promise<UsernameResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const username = await findAvailableUsername(slugifyUsername(String(displayName ?? "").slice(0, 60)), user.id);
  return { ok: true, username };
}

/** Checks a handle the user typed (format, reserved, taken) without claiming it. */
export async function checkUsername(displayUsername: string): Promise<UsernameResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const value = String(displayUsername ?? "").trim();
  const invalid = usernameError(value);
  if (invalid) return { ok: false, error: invalid };
  if (await isUsernameTaken(value.toLowerCase(), user.id)) return { ok: false, error: USERNAME_TAKEN };
  return { ok: true, username: value };
}

// Every field is optional: updateProfile only writes what the submitting
// form actually carries, so saving one Settings block never clears another
// block's answers (e.g. onboarding's preferred days and limitations).
const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1, "Informe seu nome.").max(60, "Máximo de 60 caracteres."),
    bio: z.string().trim().max(280, "Máximo de 280 caracteres."),
    goal: z.enum(TRAINING_GOALS, { error: "Escolha um objetivo." }),
    experience: z.enum(EXPERIENCE_LEVELS, { error: "Escolha sua experiência." }),
    daysPerWeek: z.coerce.number({ error: "Escolha de 1 a 7 dias." }).int().min(1, "Escolha de 1 a 7 dias.").max(7, "Escolha de 1 a 7 dias."),
    sessionMinutes: z.coerce
      .number({ error: "Duração inválida." })
      .int()
      .min(15, "Duração inválida.")
      .max(180, "Duração inválida."),
    equipmentAccess: z.enum(EQUIPMENT_ACCESS_OPTIONS, { error: "Escolha um equipamento." }),
    preferredDays: z.array(z.coerce.number().int().min(0).max(6), { error: "Dias inválidos." }),
    doesEndurance: z.boolean(),
    enduranceNotes: z.string().trim().max(300, "Máximo de 300 caracteres."),
    limitations: z.string().trim().max(500, "Máximo de 500 caracteres."),
  })
  .partial();

export type ProfileField = keyof z.infer<typeof profileUpdateSchema>;

export interface ProfileUpdateState {
  ok?: boolean;
  /** ISO time of the last successful save — changes on every save, so the form can flash "SALVO ✓". */
  savedAt?: string;
  error?: string;
  fieldErrors?: Partial<Record<ProfileField, string>>;
}

const SCALAR_FIELDS = [
  "displayName",
  "bio",
  "goal",
  "experience",
  "daysPerWeek",
  "sessionMinutes",
  "equipmentAccess",
  "enduranceNotes",
  "limitations",
] as const satisfies readonly ProfileField[];

/**
 * Reads only the fields present in the submission. Multi-value and checkbox
 * fields can't rely on presence (no chips / unchecked sends nothing), so forms
 * that own them include a sentinel hidden input: `preferredDays=""` and
 * `doesEndurance="off"` ahead of the real values.
 */
function readProfileForm(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const field of SCALAR_FIELDS) {
    const value = formData.get(field);
    if (value !== null) raw[field] = value;
  }
  if (formData.has("preferredDays")) {
    raw.preferredDays = formData.getAll("preferredDays").filter((v) => v !== "");
  }
  if (formData.has("doesEndurance")) {
    raw.doesEndurance = formData.getAll("doesEndurance").includes("on");
  }
  return raw;
}

export async function updateProfile(_prev: ProfileUpdateState, formData: FormData): Promise<ProfileUpdateState> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  const parsed = profileUpdateSchema.safeParse(readProfileForm(formData));
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ProfileField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]) as ProfileField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, error: "Revise os campos destacados.", fieldErrors };
  }
  const data = parsed.data;

  // `undefined` leaves a column untouched in Prisma — that's what keeps
  // fields the submitting form doesn't own intact.
  const nullable = (v: string | undefined) => (v === undefined ? undefined : v || null);
  try {
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        displayName: data.displayName,
        bio: nullable(data.bio),
        goal: data.goal,
        experience: data.experience,
        daysPerWeek: data.daysPerWeek,
        sessionMinutes: data.sessionMinutes,
        equipmentAccess: data.equipmentAccess,
        preferredDays: data.preferredDays ? [...new Set(data.preferredDays)].sort((a, b) => a - b) : undefined,
        doesEndurance: data.doesEndurance,
        // Unticking endurance drops its notes, as onboarding does.
        enduranceNotes: data.doesEndurance === false ? null : nullable(data.enduranceNotes),
        limitations: nullable(data.limitations),
      },
    });
  } catch (err) {
    console.error("updateProfile failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (data.preferredDays !== undefined) {
    // New preferred days re-lay the active program's week (Today's schedule, reminders).
    try {
      const active = await prisma.programEnrollment.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        select: { programId: true },
      });
      if (active) await applyWeekLayout(prisma, user.id, active.programId);
    } catch (err) {
      console.error("applyWeekLayout after profile save failed", err);
    }
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
  revalidatePath("/app/today");
  return { ok: true, savedAt: new Date().toISOString() };
}

const privacySettingsSchema = z
  .object({
    isPublicAccount: z.boolean(),
    defaultWorkoutVisibility: z.enum(["PRIVATE", "FOLLOWERS", "PUBLIC"]),
    showLoadsPublicly: z.boolean(),
    showBodyMetricsPublicly: z.boolean(),
    showCurrentProgram: z.boolean(),
    discoverable: z.boolean(),
    autoShareAchievements: z.boolean(),
  })
  .strict();

export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

export async function updatePrivacySettings(settings: PrivacySettings): Promise<SettingsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  // Validate the shape: the client object goes straight into the update, so
  // unknown keys must never reach Prisma.
  const parsed = privacySettingsSchema.safeParse(settings);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await prisma.profile.update({ where: { userId: user.id }, data: parsed.data });
  } catch (err) {
    console.error("updatePrivacySettings failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/app/settings");
  return { ok: true, savedAt: new Date().toISOString() };
}
