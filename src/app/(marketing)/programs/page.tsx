import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/require-user";
import { listTemplates } from "@/lib/data/templates";
import { SectionHead } from "@/components/ui/section-head";
import { ProtocolCard } from "@/components/programs/protocol-card";

export const metadata: Metadata = { title: "Programas" };

export default async function PublicProgramsPage() {
  const session = await getCurrentSession();
  if (session) redirect("/app/programs");

  const templates = await listTemplates();

  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Biblioteca de protocolos</span>
        <h1 className="text-display mt-1 max-w-xl text-4xl font-extrabold sm:text-5xl">Programas</h1>
        <p className="mt-3 max-w-lg text-muted">
          Protocolos prontos, construídos em torno de evidência real — objetivo, frequência e progressão
          explicados, nunca só uma planilha de exercícios.
        </p>

        <div className="mt-10">
          <SectionHead label="Todos os protocolos" count={`${templates.length}`} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {templates.map((t, i) => (
              <ProtocolCard
                key={t.id}
                data={{
                  index: i + 1,
                  href: `/programs/${t.slug}`,
                  namePt: t.namePt,
                  taglinePt: t.taglinePt,
                  goal: t.goal,
                  experienceLevel: t.experienceLevel,
                  trainingStyle: t.trainingStyle,
                  daysPerWeek: t.daysPerWeek,
                  durationWeeks: t.durationWeeks,
                  sessionMinutes: t.sessionMinutes,
                  dayNames: t.days.map((d) => d.namePt),
                  isFlagship: t.isFlagship,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
