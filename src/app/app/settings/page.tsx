import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { UsernameForm } from "./username-form";
import { PrivacyForm } from "./privacy-form";
import { DangerZone } from "./danger-zone";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) throw new Error("Profile not found");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

      <Section title="Perfil">
        <ProfileForm
          initial={{
            displayName: profile.displayName,
            bio: profile.bio ?? "",
            goal: profile.goal,
            experience: profile.experience,
            daysPerWeek: profile.daysPerWeek,
            sessionMinutes: profile.sessionMinutes,
            equipmentAccess: profile.equipmentAccess,
          }}
        />
      </Section>

      <Section title="Usuário público">
        <UsernameForm initialUsername={user.username ?? null} />
      </Section>

      <Section title="Privacidade">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <Card>
        <CardContent className="pt-5">{children}</CardContent>
      </Card>
    </section>
  );
}
