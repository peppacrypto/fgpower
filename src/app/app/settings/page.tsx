import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { isAdminUser } from "@/lib/auth/roles";
import { getProfile, getPublicHandle, getPublicProfileOrigin } from "@/lib/data/profile";
import { Masthead } from "@/components/ui/masthead";
import { Section } from "./section";
import { ProfileForm } from "./profile-form";
import { RoutineForm } from "./routine-form";
import { RemindersSection } from "./reminders-section";
import { WorkoutPreferencesForm } from "./workout-preferences-form";
import { UsernameForm } from "./username-form";
import { PrivacyForm } from "./privacy-form";
import { privacyInitial } from "./privacy-initial";
import { BlockedSection } from "./blocked-section";
import { AdminPanelLink } from "./admin-panel-link";
import { DangerZone } from "./danger-zone";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Settings, in this order: Perfil · Rotina · Lembretes · Durante o treino ·
 * Usuário público · Privacidade · Contas bloqueadas · Dados e conta. Sections
 * other areas own render their own <Section> (or nothing while unavailable).
 */
export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const sp = await searchParams;
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

      <Section id="rotina" title="Rotina" description="Quando e como você treina — usado para montar e ajustar seu programa.">
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

      <RemindersSection userId={user.id} />

      <Section title="Durante o treino">
        <WorkoutPreferencesForm initial={{ restTimerSound: profile.restTimerSound }} />
      </Section>

      <Section title="Usuário público">
        <UsernameForm initialUsername={handle} publicOrigin={publicOrigin} />
      </Section>

      <Section id="privacidade" title="Privacidade">
        <PrivacyForm initial={privacyInitial(profile)} />
      </Section>

      <BlockedSection userId={user.id} notice={sp.bloqueado === "1"} />

      <Section title="Dados e conta">
        <AdminPanelLink isAdmin={isAdminUser(user)} />
        <DangerZone />
      </Section>
    </div>
  );
}
