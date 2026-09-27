import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/require-user";
import { onboardingNextPath } from "@/lib/auth/safe-next";
import { hadSessionCookie } from "@/lib/auth/session-cookie";
import { loginAgainHref } from "@/lib/auth/session-expired";
import {
  findAvailableUsername,
  getPublicHandle,
  getPublicProfileOrigin,
  hasCompletedOnboarding,
} from "@/lib/data/profile";
import { slugifyUsername } from "@/lib/validation/username";
import { Wordmark } from "@/components/brand/logo";
import { OnboardingWizard } from "./onboarding-wizard";
import { TOTAL_STEPS } from "./steps";

export const metadata: Metadata = { title: "Primeiros passos" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const sp = await searchParams;
  // Where sign-in started (e.g. a program dossier) — the wizard ends there.
  const next = onboardingNextPath(sp.next);
  const passo = Number(Array.isArray(sp.passo) ? sp.passo[0] : sp.passo);
  const initialStep = Number.isInteger(passo) && passo >= 1 && passo <= TOTAL_STEPS ? passo - 1 : 0;

  const session = await getCurrentSession();
  if (!session) {
    // Back to this step afterwards (the answers wait in this tab). A cookie
    // that no longer resolves — signed out elsewhere, or expired on the
    // server, typically found by Concluir — gets the "sessão expirou" note
    // instead of a bare login page.
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (initialStep > 0) params.set("passo", String(initialStep + 1));
    const here = params.size > 0 ? `/onboarding?${params.toString()}` : "/onboarding";
    redirect((await hadSessionCookie()) ? loginAgainHref(here) : `/login?next=${encodeURIComponent(here)}`);
  }
  const user = session.user;
  if (await hasCompletedOnboarding(user.id)) {
    redirect(next ?? "/app/today");
  }

  // Google already told us the name: start from the first name, not a blank field.
  const defaultName = user.name.trim().split(/\s+/)[0] ?? "";
  const [existingHandle, publicOrigin] = await Promise.all([getPublicHandle(user.id), getPublicProfileOrigin()]);
  const suggestedHandle = existingHandle ?? (await findAvailableUsername(slugifyUsername(defaultName), user.id));

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mb-8">
        <Wordmark iconSize={32} />
      </div>
      <OnboardingWizard
        userId={user.id}
        defaultName={defaultName}
        defaultUsername={suggestedHandle}
        hasHandle={Boolean(existingHandle)}
        publicOrigin={publicOrigin}
        next={next}
        initialStep={initialStep}
      />
    </main>
  );
}
