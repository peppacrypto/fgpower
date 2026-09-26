"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import {
  EQUIPMENT_ACCESS_OPTIONS,
  EXPERIENCE_LEVELS,
  TRAINING_GOALS,
} from "@/lib/validation/onboarding";
import { z } from "zod";

const RESERVED_USERNAMES = new Set([
  "admin", "api", "app", "fgpower", "settings", "login", "logout", "onboarding",
  "programs", "exercises", "workout", "history", "progress", "profile", "feed",
  "u", "science", "privacy", "terms", "support", "help", "root", "null", "undefined",
]);

const GENERIC_ERROR = "Não foi possível salvar agora. Tente de novo.";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Mínimo de 3 caracteres.")
  .max(24, "Máximo de 24 caracteres.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use apenas letras, números e underline.");

export type UsernameResult = { ok: true; username: string } | { ok: false; error: string };

export async function claimUsername(displayUsername: string): Promise<UsernameResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = usernameSchema.safeParse(displayUsername);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nome de usuário inválido." };
  }
  const normalized = parsed.data.toLowerCase();
  if (RESERVED_USERNAMES.has(normalized)) {
    return { ok: false, error: "Este nome de usuário não está disponível." };
  }

  const existing = await prisma.user.findUnique({ where: { username: normalized } });
  if (existing && existing.id !== user.id) {
    return { ok: false, error: "Este nome de usuário já está em uso." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { username: normalized, displayUsername: parsed.data },
    });
  } catch (err) {
    // Lost a race for the same name between the check above and the write.
    if ((err as { code?: string }).code === "P2002") return { ok: false, error: "Este nome de usuário já está em uso." };
    console.error("claimUsername failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  // The session cookie cache still carries the old handle (pages that read
  // session.user.username would show it for up to 5 min). Re-reading the
  // session past the cache rewrites that cookie via nextCookies().
  try {
    await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  } catch (err) {
    console.warn("claimUsername: session cache refresh failed", err);
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
  return { ok: true, username: parsed.data };
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
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

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

export type SettingsSaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

export async function updatePrivacySettings(settings: PrivacySettings): Promise<SettingsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
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

const workoutPreferencesSchema = z.object({ restTimerSound: z.boolean() }).strict();

export type WorkoutPreferences = z.infer<typeof workoutPreferencesSchema>;

/** Workout-screen preferences (autosaved toggles in Settings → Treino). */
export async function updateWorkoutPreferences(prefs: WorkoutPreferences): Promise<SettingsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = workoutPreferencesSchema.safeParse(prefs);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await prisma.profile.update({ where: { userId: user.id }, data: parsed.data });
  } catch (err) {
    console.error("updateWorkoutPreferences failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/app/settings");
  return { ok: true, savedAt: new Date().toISOString() };
}
