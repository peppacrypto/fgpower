import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { hasCompletedOnboarding } from "@/lib/data/profile";
import { Wordmark } from "@/components/brand/logo";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await hasCompletedOnboarding(user.id)) {
    redirect("/app/today");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-10">
      <div className="mb-10">
        <Wordmark iconSize={32} />
      </div>
      <OnboardingWizard />
    </div>
  );
}
