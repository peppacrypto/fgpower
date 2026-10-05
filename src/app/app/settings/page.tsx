import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentSession, requireUser } from "@/lib/auth/require-user";
import { isAdminUser } from "@/lib/auth/roles";
import { getProfile, getPublicHandle, getPublicProfileOrigin } from "@/lib/data/profile";
import { prisma } from "@/lib/db";
import { Masthead } from "@/components/ui/masthead";
import { Section } from "./section";
import { ProfileForm } from "./profile-form";
import { RoutineForm } from "./routine-form";
import { RemindersSection } from "./reminders-section";
import { WorkoutPreferencesForm } from "./workout-preferences-form";
import { ThemeForm } from "./theme-form";
import { THEME_COOKIE, parseThemeChoice } from "@/lib/theme";
import { UsernameForm } from "./username-form";
import { PrivacyForm } from "./privacy-form";
import { privacyInitial } from "./privacy-initial";
import { BlockedSection } from "./blocked-section";
import { AdminPanelLink } from "./admin-panel-link";
import { DangerZone } from "./danger-zone";
import { ScrollToHash } from "./scroll-to-hash";

export const metadata: Metadata = { title: "Configurações" };

/** Deleting the account needs a sign-in this recent (better-auth freshAge, lib/auth/auth.ts). */
const FRESH_LOGIN_MS = 24 * 60 * 60 * 1000;

function isFreshLogin(sessionCreatedAt: Date | string): boolean {
  return Date.now() - new Date(sessionCreatedAt).getTime() < FRESH_LOGIN_MS;
}

/**
 * Settings, in this order: Perfil · Rotina · Lembretes · Durante o treino ·
 * Aparência · Usuário público · Privacidade · Contas bloqueadas · Dados e
 * conta. Sections other areas own render their own <Section> (or nothing
 * while unavailable).
 */
export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const sp = await searchParams;
  const user = await requireUser();
  const [profile, handle, publicOrigin, session, cookieStore, activeEnrollment] = await Promise.all([
    getProfile(user.id),
    getPublicHandle(user.id),
    getPublicProfileOrigin(),
    getCurrentSession(),
    cookies(),
    // Rotina's "Dias por semana" follows the active program's frequency (A-025).
    prisma.programEnrollment.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { program: { select: { id: true, name: true, daysPerWeek: true } } },
    }),
  ]);
  if (!profile) throw new Error("Profile not found");
  // The page is dynamic already (it reads the session): the theme control renders the device's choice.
  const theme = parseThemeChoice(cookieStore.get(THEME_COOKIE)?.value);
  const freshLogin = session ? isFreshLogin(session.session.createdAt) : false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Masthead kicker="Sua conta" title="Configurações" />

      <Section id="perfil" title="Perfil">
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
          activeProgram={
            activeEnrollment
              ? {
                  id: activeEnrollment.program.id,
                  name: activeEnrollment.program.name,
                  daysPerWeek: activeEnrollment.program.daysPerWeek,
                }
              : null
          }
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

      <Section id="durante-o-treino" title="Durante o treino" description="Vale para todos os seus treinos.">
        <WorkoutPreferencesForm
          initial={{
            restTimerSound: profile.restTimerSound,
            hapticsEnabled: profile.hapticsEnabled,
            loadIncrementKg: profile.loadIncrementKg,
          }}
        />
      </Section>

      <Section id="aparencia" title="Aparência" description="Neste aparelho.">
        <ThemeForm initial={theme} />
      </Section>

      <Section id="usuario" title="Usuário público">
        <UsernameForm initialUsername={handle} publicOrigin={publicOrigin} />
      </Section>

      <Section id="privacidade" title="Privacidade">
        <PrivacyForm initial={privacyInitial(profile)} />
      </Section>

      <BlockedSection userId={user.id} notice={sp.bloqueado === "1"} />

      <Section id="dados-e-conta" title="Dados e conta">
        <AdminPanelLink isAdmin={isAdminUser(user)} />
        {/* A-009 — the policy and the art. 18 request channel, reachable from
            inside the installed PWA (the app shell has no footer). */}
        <nav aria-label="Privacidade" className="mb-4 flex flex-wrap gap-x-4 gap-y-1 border-b border-border pb-4 text-sm">
          <Link href="/privacy" className="text-accent hover:underline">Privacidade</Link>
          <Link href="/terms" className="text-accent hover:underline">Termos</Link>
          <Link href="/privacidade/solicitar" className="text-accent hover:underline">Solicitar meus dados</Link>
        </nav>
        <DangerZone
          account={{ email: user.email, name: user.name }}
          freshLogin={freshLogin}
          openDelete={sp.excluir === "1"}
        />
      </Section>
      {/* Last, so it runs once every section is in: links land on #usuario, #lembretes… */}
      <ScrollToHash />
    </div>
  );
}
