import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { listTemplates } from "@/lib/data/templates";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { ProtocolCard } from "@/components/programs/protocol-card";

export const metadata: Metadata = { title: "Programas" };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Ativo", color: "var(--accent)" },
  DRAFT: { label: "Rascunho", color: "var(--muted)" },
  ARCHIVED: { label: "Arquivado", color: "var(--warning)" },
};

export default async function ProgramsPage() {
  const user = await requireUser();
  const [myPrograms, templates] = await Promise.all([
    prisma.userProgram.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { updatedAt: "desc" },
      include: { days: { select: { id: true, name: true }, orderBy: { dayIndex: "asc" } } },
    }),
    listTemplates(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Masthead */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Sua estante</span>
          <h1 className="text-display mt-1 text-4xl font-extrabold sm:text-5xl">Programas</h1>
        </div>
        <Button variant="strong" asChild>
          <Link href="/app/programs/new">
            <Plus className="size-4" />
            Criar
          </Link>
        </Button>
      </div>

      {/* Meus programas */}
      <section className="mt-12">
        <SectionHead label="Meus programas" count={myPrograms.length ? `${myPrograms.length} ativo(s)` : undefined} />
        {myPrograms.length === 0 ? (
          <Link
            href="/app/programs/new"
            className="mt-4 flex flex-col items-start gap-1 rounded-[var(--radius-lg)] border border-dashed border-border-strong p-6 transition-colors hover:border-accent hover:bg-accent-soft/30"
          >
            <span className="font-mono text-2xl font-bold text-foreground/20">＋</span>
            <span className="mt-1 font-semibold">Monte seu primeiro protocolo</span>
            <span className="text-sm text-muted">Do zero, ou personalize um pronto da biblioteca abaixo.</span>
          </Link>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {myPrograms.map((p, i) => (
              <Link
                key={p.id}
                href={`/app/programs/${p.id}`}
                className="group relative flex overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-all hover:border-border-strong hover:shadow-md"
              >
                <span className="w-1 shrink-0" style={{ background: STATUS_LABEL[p.status].color }} aria-hidden />
                <div className="relative min-w-0 flex-1 p-5">
                  <span className="pointer-events-none absolute right-4 top-2 font-mono text-4xl font-bold tabular-nums text-foreground/[0.06]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: STATUS_LABEL[p.status].color }}
                  >
                    {STATUS_LABEL[p.status].label}
                  </span>
                  <h3 className="mt-1.5 max-w-[85%] font-bold leading-tight">{p.name}</h3>
                  {p.days.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.days.map((d) => (
                        <span
                          key={d.id}
                          className="rounded-[4px] bg-surface-2 px-1.5 py-1 font-mono text-[10px] text-foreground/70"
                        >
                          {d.name.replace(/^(dia|sess(ã|a)o)\s+/i, "").slice(0, 10).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted">Sem dias ainda</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Biblioteca */}
      <section className="mt-14">
        <SectionHead label="Biblioteca de protocolos" count={`${templates.length}`} />
        {templates.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhum programa disponível ainda.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {templates.map((t, i) => (
              <ProtocolCard
                key={t.id}
                data={{
                  index: i + 1,
                  href: `/app/programs/templates/${t.slug}`,
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
        )}
      </section>
    </div>
  );
}
