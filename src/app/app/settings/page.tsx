import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile, getPublicHandle, getPublicProfileOrigin } from "@/lib/data/profile";
import { Card, CardContent } from "@/components/ui/card";
import { Masthead } from "@/components/ui/masthead";
import { SectionHead } from "@/components/ui/section-head";
import { ProfileForm } from "./profile-form";
import { RoutineForm } from "./routine-form";
import { WorkoutPreferencesForm } from "./workout-preferences-form";
import { UsernameForm } from "./username-form";
import { PrivacyForm } from "./privacy-form";
import { DangerZone } from "./danger-zone";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, handle, publicOrigin] = await Promise.all([
    getProfile(user.id),
    getPublicHandle(user.id),
    getPublicProfileOrigin(),
  ]);
  if (!profile) throw new Error("Profile not found");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Masthead kicker="Sua conta" title="Configurações" />

      <Section title="Perfil">
        <ProfileForm
          initial={{
            displayName: profile.displayName,
            bio: profile.bio ?? "",
            goal: profile.goal,
            experience: profile.experience,
            equipmentAccess: profile.equipmentAccess,
          }}
        />
      </Section>

      <Section title="Rotina" description="Quando e como você treina — usado para montar e ajustar seu programa.">
        <RoutineForm
          initial={{
            daysPerWeek: profile.daysPerWeek,
            sessionMinutes: profile.sessionMinutes,
            preferredDays: profile.preferredDays,
            doesEndurance: profile.doesEndurance,
            enduranceNotes: profile.enduranceNotes ?? "",
            limitations: profile.limitations ?? "",
          }}
        />
      </Section>

      <Section title="Durante o treino">
        <WorkoutPreferencesForm initial={{ restTimerSound: profile.restTimerSound }} />
      </Section>

      <Section title="Usuário público">
        <UsernameForm initialUsername={handle} publicOrigin={publicOrigin} />
      </Section>

      <Section id="privacidade" title="Privacidade">
        <PrivacyForm
          initial={{
            isPublicAccount: profile.isPublicAccount,
            defaultWorkoutVisibility: profile.defaultWorkoutVisibility,
            showLoadsPublicly: profile.showLoadsPublicly,
            showBodyMetricsPublicly: profile.showBodyMetricsPublicly,
            showCurrentProgram: profile.showCurrentProgram,
            discoverable: profile.discoverable,
            autoShareAchievements: profile.autoShareAchievements,
          }}
        />
      </Section>

      <Section title="Dados e conta">
        <DangerZone />
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-4">
      <SectionHead label={title} />
      {description ? <p className="mt-1.5 text-xs text-muted">{description}</p> : null}
      <Card className="mt-3">
        <CardContent className="pt-5">{children}</CardContent>
      </Card>
    </section>
  );
}
