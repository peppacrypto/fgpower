"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation/onboarding";

export interface OnboardingFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function completeOnboarding(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const user = await requireUserOrThrow();

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

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayName: data.displayName,
      goal: data.goal,
      experience: data.experience,
      daysPerWeek: data.daysPerWeek,
      sessionMinutes: data.sessionMinutes,
      equipmentAccess: data.equipmentAccess,
      preferredDays: data.preferredDays,
      doesEndurance: data.doesEndurance,
      enduranceNotes: data.enduranceNotes || null,
      limitations: data.limitations || null,
      onboardingCompletedAt: new Date(),
    },
    update: {
      displayName: data.displayName,
      goal: data.goal,
      experience: data.experience,
      daysPerWeek: data.daysPerWeek,
      sessionMinutes: data.sessionMinutes,
      equipmentAccess: data.equipmentAccess,
      preferredDays: data.preferredDays,
      doesEndurance: data.doesEndurance,
      enduranceNotes: data.enduranceNotes || null,
      limitations: data.limitations || null,
      onboardingCompletedAt: new Date(),
    },
  });

  redirect("/app/today");
}
