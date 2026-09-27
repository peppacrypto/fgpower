import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/data/profile";
import { getActiveEnrollment } from "@/lib/data/dashboard";
import { listTemplates, recommendProfileOf, toCatalogItem } from "@/lib/data/templates";
import { recommendTemplates } from "@/lib/programming/recommend";
import { presetFilters } from "@/lib/programming/catalog";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { ProtocolLibrary } from "@/components/programs/protocol-library";
import { DayChips, type ProtocolCardData } from "@/components/programs/protocol-card";
import { RecommendedPanel } from "@/components/programs/recommended-panel";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Programas" };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Ativo", color: "var(--accent)" },
  DRAFT: { label: "Rascunho", color: "var(--muted)" },
  ARCHIVED: { label: "Arquivado", color: "var(--warning)" },
};

export default async function ProgramsPage() {
  const user = await requireUser();
  const [myPrograms, templates, profile, enrollment] = await Promise.all([
    prisma.userProgram.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { updatedAt: "desc" },
      include: { days: { select: { id: true, name: true }, orderBy: { dayIndex: "asc" } } },
    }),
    listTemplates(),
    getProfile(user.id),
    getActiveEnrollment(user.id),
  ]);

  const catalog = templates.map(toCatalogItem);
  const answers = recommendProfileOf(profile);
  // Never recommend the program the user is already following.
  const runningTemplateId = enrollment?.program.sourceTemplateId ?? null;
  const runningSlug = templates.find((t) => t.id === runningTemplateId)?.slug;
  const recommendations = answers
    ? recommendTemplates(answers, catalog).filter((r) => r.template.slug !== runningSlug)
    : [];
  // The featured slot is the user's own best fit; the flagship only for someone we know nothing about.
  const featured = recommendations[0]?.template.slug ?? catalog.find((t) => t.isFlagship)?.slug;
  const items: ProtocolCardData[] = catalog.map((t, i) => ({
    ...t,
    index: i + 1,
    href: `/app/programs/templates/${t.slug}`,
    mark: t.slug === featured ? (recommendations.length > 0 ? "Para você" : "Destaque") : null,
  }));
  const bySlug = new Map(items.map((t) => [t.slug, t]));
  const hasPrograms = myPrograms.length > 0;

  const createCard = (
    <Link
      href="/app/programs/new"
      className="mt-4 flex flex-col items-start gap-1 rounded-[var(--radius-lg)] border border-dashed border-border-strong p-6 transition-colors hover:border-accent hover:bg-accent-soft/30"
    >
      <span className="font-mono text-2xl font-bold text-foreground/20">＋</span>
      <span className="mt-1 font-semibold">Monte seu próprio programa</span>
      <span className="text-sm text-muted">Do zero, ou abra um pronto e toque em “Personalizar”.</span>
    </Link>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Masthead */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Sua estante</span>
          <h1 className="text-display mt-1 text-4xl font-extrabold sm:text-5xl">Programas</h1>
          {/* The principles every program is built on (the evidence library). Inline, so on a
              narrow phone the arrow wraps with the last word instead of floating at the edge. */}
          <p className="mt-1 -mb-2 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
            <Link href="/app/science" className="py-2 text-accent hover:underline">
              Ciência dos{" "}
              <span className="whitespace-nowrap">
                programas
                <GArrow className="ml-1 inline-block size-3 align-[-1px]" />
              </span>
            </Link>
          </p>
        </div>
        {/* Building from scratch is the hard path: it only leads once the user has programs. */}
        <Button variant={hasPrograms ? "strong" : "outline"} asChild className="shrink-0">
          <Link href="/app/programs/new">
            <Plus className="size-4" />
            Criar
          </Link>
        </Button>
      </div>

      <ProtocolLibrary
        label="Biblioteca de programas"
        items={items}
        // The chips never hide the "Para você" pick.
        preset={answers ? presetFilters(answers, catalog, recommendations[0]?.template.slug ?? null) : null}
        pick={recommendations[0]?.template.slug ?? null}
        suggestions={recommendations
          .slice(0, 3)
          .map((r) => bySlug.get(r.template.slug))
          .filter((t): t is ProtocolCardData => Boolean(t))}
      >
        {hasPrograms ? (
          <section className="mt-10">
            <SectionHead label="Meus programas" count={plural(myPrograms.length, "programa", "programas")} />
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              {myPrograms.map((p, i) => {
                const running = enrollment?.programId === p.id ? enrollment : null;
                return (
                  <Link
                    key={p.id}
                    href={`/app/programs/${p.id}`}
                    className="group relative flex min-w-0 flex-col bg-surface p-5 pt-4 transition-colors hover:bg-[var(--ink-2)]"
                    style={{ borderTop: `2px solid ${STATUS_LABEL[p.status].color}` }}
                  >
                    <span className="pointer-events-none absolute right-4 top-3 font-mono text-4xl font-bold tabular-nums text-foreground/[0.06]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: STATUS_LABEL[p.status].color }}
                    >
                      {STATUS_LABEL[p.status].label}
                    </span>
                    <h3 className="mt-1.5 max-w-[85%] font-bold leading-tight">{p.name}</h3>
                    {running ? (
                      // The running program says where it stands, not what its days are called.
                      <WeekMeter week={running.currentWeek} weeks={running.program.durationWeeks} />
                    ) : p.days.length > 0 ? (
                      <DayChips names={p.days.map((d) => d.name)} className="mt-3" />
                    ) : (
                      <p className="mt-2 text-xs text-muted">Sem dias ainda</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* The pick leads while nothing is running; with a program running, the filtered library is enough. */}
        {recommendations.length > 0 && !enrollment ? (
          <RecommendedPanel
            className="mt-10"
            fatLoss={answers?.goal === "FAT_LOSS"}
            picks={recommendations.slice(0, 3).map((r) => ({
              slug: r.template.slug,
              namePt: r.template.namePt,
              taglinePt: r.template.taglinePt,
              reasons: r.reasons,
            }))}
          />
        ) : null}
      </ProtocolLibrary>

      {hasPrograms ? null : (
        <section className="mt-14">
          <SectionHead label="Não achou o seu?" />
          {createCard}
        </section>
      )}
    </div>
  );
}

/** "SEM. 3/13" with a hairline week meter. */
function WeekMeter({ week, weeks }: { week: number; weeks: number | null }) {
  if (!weeks) {
    return <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Sem. {week}</p>;
  }
  return (
    <div className="mt-3">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        Sem. {Math.min(week, weeks)}/{weeks}
      </p>
      <div className="mt-1.5 flex gap-0.5" aria-hidden>
        {Array.from({ length: weeks }, (_, i) => (
          <span key={i} className={`h-1 flex-1 ${i < week ? "bg-accent" : "bg-surface-2"}`} />
        ))}
      </div>
    </div>
  );
}
