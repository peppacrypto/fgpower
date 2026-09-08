"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { z } from "zod";

const RESERVED_USERNAMES = new Set([
  "admin", "api", "app", "fgpower", "settings", "login", "logout", "onboarding",
  "programs", "exercises", "workout", "history", "progress", "profile", "feed",
  "u", "science", "privacy", "terms", "support", "help", "root", "null", "undefined",
]);

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Mínimo de 3 caracteres.")
  .max(24, "Máximo de 24 caracteres.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use apenas letras, números e underline.");

export interface UsernameResult {
  error?: string;
}

export async function claimUsername(displayUsername: string): Promise<UsernameResult> {
  const user = await requireUserOrThrow();
  const parsed = usernameSchema.safeParse(displayUsername);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nome de usuário inválido." };
  }
  const normalized = parsed.data.toLowerCase();
  if (RESERVED_USERNAMES.has(normalized)) {
    return { error: "Este nome de usuário não está disponível." };
  }

  const existing = await prisma.user.findUnique({ where: { username: normalized } });
  if (existing && existing.id !== user.id) {
    return { error: "Este nome de usuário já está em uso." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { username: normalized, displayUsername: parsed.data },
  });
  revalidatePath("/app/settings");
  return {};
}

const profileUpdateSchema = onboardingSchema.omit({}).partial().extend({
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
});

export interface ProfileUpdateState {
  error?: string;
}

export async function updateProfile(_prev: ProfileUpdateState, formData: FormData): Promise<ProfileUpdateState> {
  const user = await requireUserOrThrow();

  const raw = {
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
    goal: formData.get("goal"),
    experience: formData.get("experience"),
    daysPerWeek: formData.get("daysPerWeek"),
    sessionMinutes: formData.get("sessionMinutes"),
    equipmentAccess: formData.get("equipmentAccess"),
    preferredDays: formData.getAll("preferredDays"),
    doesEndurance: formData.get("doesEndurance") === "on",
    enduranceNotes: formData.get("enduranceNotes") ?? "",
    limitations: formData.get("limitations") ?? "",
  };

  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Revise os campos destacados." };
  }
  const data = parsed.data;

  await prisma.profile.update({
    where: { userId: user.id },
    data: {
      displayName: data.displayName,
      bio: data.bio || null,
      goal: data.goal,
      experience: data.experience,
      daysPerWeek: data.daysPerWeek,
      sessionMinutes: data.sessionMinutes,
      equipmentAccess: data.equipmentAccess,
      preferredDays: data.preferredDays,
      doesEndurance: data.doesEndurance,
      enduranceNotes: data.enduranceNotes || null,
      limitations: data.limitations || null,
    },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
  return {};
}

export interface PrivacySettings {
  isPublicAccount: boolean;
  defaultWorkoutVisibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
  showLoadsPublicly: boolean;
  showBodyMetricsPublicly: boolean;
  showCurrentProgram: boolean;
  discoverable: boolean;
  autoShareAchievements: boolean;
}

export async function updatePrivacySettings(settings: PrivacySettings) {
  const user = await requireUserOrThrow();
  await prisma.profile.update({ where: { userId: user.id }, data: settings });
  revalidatePath("/app/settings");
}
