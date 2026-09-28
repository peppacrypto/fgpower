import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/data/profile";
import { getActiveEnrollment } from "@/lib/data/dashboard";
import { getBlockProgress, getSeriesContinuation } from "@/lib/data/program-lifecycle";
import { listTemplates, recommendProfileOf, toCatalogItem } from "@/lib/data/templates";
import { recommendTemplates } from "@/lib/programming/recommend";
import { presetFilters } from "@/lib/programming/catalog";
import { isGdSeries, seriesEntryFor } from "@/lib/programming/gd-series";
import { restoreArchivedProgram } from "@/lib/actions/programs";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionHead } from "@/components/ui/section-head";
import { ProtocolLibrary } from "@/components/programs/protocol-library";
import { DayChips, type ProtocolCardData } from "@/components/programs/protocol-card";
import { RecommendedPanel } from "@/components/programs/recommended-panel";
import { ResumeProgramPanel } from "@/components/programs/resume-program-panel";
import { BlockProgressMeter } from "@/components/programs/block-progress-meter";
import { formatAppDate } from "@/lib/training/week";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Programas" };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Ativo", color: "var(--accent)" },
  DRAFT: { label: "Rascunho", color: "var(--muted)" },
  ARCHIVED: { label: "Arquivado", color: "var(--warning)" },
};

export default async function ProgramsPage({ searchParams }: PageProps<"/app/programs">) {
  const user = await requireUser();
  const deleted = (await searchParams).excluido === "1";
  const [myPrograms, archived, templates, profile, enrollment, continuation] = await Promise.all([
    prisma.userProgram.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { updatedAt: "desc" },
      include: { days: { select: { id: true, name: true }, orderBy: { dayIndex: "asc" } } },
    }),
    // "Arquivados": ended by hand, by a switch, or finished ("Concluído").
    prisma.userProgram.findMany({
      where: { userId: user.id, status: "ARCHIVED" },
      orderBy: [{ archivedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        archivedAt: true,
        updatedAt: true,
        enrollments: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true } },
        _count: { select: { sessions: { where: { status: "COMPLETED" } } } },
      },
    }),
    listTemplates(),
    getProfile(user.id),
    getActiveEnrollment(user.id),
    // Where the GD series goes on (the next block after the one finished), or the program stopped mid-block.
    getSeriesContinuation(user.id),
  ]);
  const progress = enrollment
    ? await getBlockProgress(prisma, user.id, {
        id: enrollment.id,
        currentWeek: enrollment.currentWeek,
        startedAt: enrollment.startedAt,
        program: {
          durationWeeks: enrollment.program.durationWeeks,
          daysPerWeek: enrollment.program.daysPerWeek,
          dayCount: enrollment.program.days.length,
        },
      })
    : null;

  const catalog = templates.map(toCatalogItem);
  const answers = recommendProfileOf(profile);
  // Never recommend the program the user is already following.
  const runningTemplateId = enrollment?.program.sourceTemplateId ?? null;
  const runningSlug = templates.find((t) => t.id === runningTemplateId)?.slug;
  // After a finished GD block, its next block leads and the blocks behind it drop out.
  const recommendations = answers
    ? recommendTemplates(answers, catalog, {
        finishedGd: continuation.finishedGd,
        stoppedGd: continuation.resume?.templateSlug,
      }).filter(
        (r) => r.template.slug !== runningSlug,
      )
    : [];
  // The featured slot is the user's own best fit (the series' next block after one); the flagship
  // only for someone we know nothing about.
  const featured =
    recommendations[0]?.template.slug ?? continuation.next?.slug ?? catalog.find((t) => t.isFlagship)?.slug;
  // The GD card: blocks finished, the next one, a block stopped mid-way ("Retomar"), the plan done ("Repetir").
  const resumeGd = continuation.resume && isGdSeries(continuation.resume.templateSlug) ? continuation.resume : null;
  const seriesProgress = {
    finished: continuation.finishedGd,
    next: continuation.next?.slug ?? null,
    resume: resumeGd
      ? { slug: resumeGd.templateSlug as string, href: `/app/programs/${resumeGd.programId}`, week: resumeGd.week }
      : null,
    // The whole plan done: GD 8 again (its page's "Repetir bloco"), never "Começar pela Adaptação".
    repeat: continuation.done ? { slug: continuation.done.slug, href: `/app/programs/${continuation.done.programId}` } : null,
  };
  const items: ProtocolCardData[] = catalog.map((t, i) => ({
    ...t,
    index: i + 1,
    href: `/app/programs/templates/${t.slug}`,
    mark:
      t.slug === runningSlug
        ? "Seu programa"
        : t.slug === featured
          ? recommendations.length > 0
            ? "Para você"
            : "Destaque"
          : null,
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

      {deleted ? (
        <p role="status" className="mt-6 border-l-2 border-l-success bg-surface-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
          Programa excluído
        </p>
      ) : null}

      <ProtocolLibrary
        label="Biblioteca de programas"
        items={items}
        seriesEntry={seriesEntryFor(profile?.onboardingCompletedAt ? profile.experience : null)}
        runningSlug={runningSlug ?? null}
        seriesProgress={seriesProgress}
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
                    {running && progress ? (
                      // The running program says where it stands, not what its days are called.
                      <BlockProgressMeter progress={progress} className="mt-3" />
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

        {archived.length > 0 ? <ArchivedPrograms programs={archived} /> : null}

        {/* While nothing runs, a program stopped mid-block picks up where it was — ahead of a fresh pick. */}
        {continuation.resume && !enrollment ? <ResumeProgramPanel resume={continuation.resume} className="mt-10" /> : null}

        {/* The pick leads while nothing is running; with a program running, the filtered library is enough. */}
        {recommendations.length > 0 && !enrollment ? (
          <RecommendedPanel
            className={continuation.resume ? "mt-3" : "mt-10"}
            // Under "Retomar", a fresh start is the alternative: one primary action on the page.
            secondary={Boolean(continuation.resume)}
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

/**
 * "Arquivados (n)": programs ended by hand or by a switch, and finished ones
 * ("Concluído"), folded away under the user's programs. "Restaurar" puts one
 * back on the shelf, where its page offers to pick it up again.
 */
function ArchivedPrograms({
  programs,
}: {
  programs: {
    id: string;
    name: string;
    archivedAt: Date | null;
    updatedAt: Date;
    enrollments: { status: string }[];
    _count: { sessions: number };
  }[];
}) {
  return (
    <details className="group mt-6 border-t border-border" data-testid="archived-programs">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted [&::-webkit-details-marker]:hidden">
        <span>Arquivados ({programs.length})</span>
        <GArrow className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <ul className="flex flex-col divide-y divide-border border-b border-border">
        {programs.map((p) => {
          const completed = p.enrollments[0]?.status === "COMPLETED";
          const when = formatAppDate(p.archivedAt ?? p.updatedAt, { day: "2-digit", month: "short" }).replace(".", "");
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <Link href={`/app/programs/${p.id}`} className="min-w-0 flex-1 basis-40 hover:text-accent">
                <span className="block font-semibold leading-tight">{p.name}</span>
                <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted">
                  {completed ? "Concluído" : "Arquivado"} · {when}
                  {p._count.sessions > 0 ? ` · ${plural(p._count.sessions, "treino", "treinos")}` : ""}
                </span>
              </Link>
              <form action={restoreArchivedProgram.bind(null, p.id)}>
                <SubmitButton size="sm" variant="outline" pendingLabel="Restaurando…">
                  Restaurar
                </SubmitButton>
              </form>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
