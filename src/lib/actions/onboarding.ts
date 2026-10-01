"use server";

import { redirect } from "next/navigation";
import { refreshSessionCache } from "@/lib/auth/refresh-session";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { onboardingNextPath } from "@/lib/auth/safe-next";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { findAvailableUsername, isUsernameTaken } from "@/lib/data/profile";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { NEW_PROFILE_SHARING } from "@/lib/social/publish";
import { slugifyUsername, usernameError, USERNAME_TAKEN } from "@/lib/validation/username";

export interface OnboardingFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function completeOnboarding(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const user = await requireUserOrThrow().catch(() => null);
  // The wizard keeps the answers in this tab (sessionStorage), so signing in
  // again brings the user back to a filled-in wizard.
  if (!user) return { error: SESSION_EXPIRED_ERROR };

  const raw = {
    displayName: formData.get("displayName"),
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

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  const data = parsed.data;

  // Public handle: what the user typed, or — left empty or untouched — one
  // derived from the display name, so every account can be found and followed.
  const handle = await assignUsername(user.id, {
    typed: String(formData.get("username") ?? "").trim(),
    // "1" while the field still holds our suggestion: a collision then just
    // moves on to the next free variant instead of failing the whole wizard.
    auto: formData.get("usernameAuto") === "1",
    displayName: data.displayName,
  });
  if (!handle.ok) {
    return { error: "Revise os campos destacados.", fieldErrors: { username: handle.error } };
  }

  const answers = {
    displayName: data.displayName,
    goal: data.goal,
    experience: data.experience,
    daysPerWeek: data.daysPerWeek,
    sessionMinutes: data.sessionMinutes,
    equipmentAccess: data.equipmentAccess,
    preferredDays: [...new Set(data.preferredDays)].sort((a, b) => a - b),
    doesEndurance: data.doesEndurance,
    enduranceNotes: data.doesEndurance ? data.enduranceNotes || null : null,
    limitations: data.limitations || null,
    onboardingCompletedAt: new Date(),
  };
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...answers, ...NEW_PROFILE_SHARING },
    update: answers,
  });
  // An account made by e-mail has no name (Google gives one): activity cards
  // and avatars read user.name, so the display name fills it in.
  const nameChanged = user.name.trim() === "";
  if (nameChanged) await prisma.user.update({ where: { id: user.id }, data: { name: data.displayName } });
  if (handle.changed || nameChanged) await refreshSessionCache();

  // Back to where sign-in started (a program dossier, a shared profile…).
  redirect(onboardingNextPath(String(formData.get("next") ?? "")) ?? "/app/today");
}

type AssignResult = { ok: true; changed: boolean } | { ok: false; error: string };

async function assignUsername(
  userId: string,
  { typed, auto, displayName }: { typed: string; auto: boolean; displayName: string },
): Promise<AssignResult> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });

  if (typed === "" && current?.username) return { ok: true, changed: false };

  let wanted: string | null = null;
  if (typed !== "") {
    const invalid = usernameError(typed);
    if (invalid && !auto) return { ok: false, error: invalid };
    if (!invalid) {
      if (typed.toLowerCase() === current?.username) {
        await prisma.user.update({ where: { id: userId }, data: { displayUsername: typed } });
        return { ok: true, changed: false };
      }
      const taken = await isUsernameTaken(typed.toLowerCase(), userId);
      if (taken && !auto) return { ok: false, error: USERNAME_TAKEN };
      if (!taken) wanted = typed;
    }
  }

  // A few tries: the unique index can still reject a handle someone else
  // claimed between the lookup and the write.
  for (let attempt = 0; attempt < 4; attempt++) {
    const value =
      wanted ?? (await findAvailableUsername(slugifyUsername(typed && auto ? typed : displayName), userId));
    try {
      await prisma.user.update({ where: { id: userId }, data: { username: value.toLowerCase(), displayUsername: value } });
      return { ok: true, changed: true };
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
      if (wanted && !auto) return { ok: false, error: USERNAME_TAKEN };
      wanted = null;
    }
  }
  return { ok: false, error: USERNAME_TAKEN };
}
