import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { GArrow, GCheck } from "@/components/ui/glyph";
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
import { Masthead } from "@/components/ui/masthead";
import { ProtocolLibrary } from "@/components/programs/protocol-library";
import { type ProtocolCardData } from "@/components/programs/protocol-card";
import { RecommendedPanel } from "@/components/programs/recommended-panel";
import { ResumeProgramPanel } from "@/components/programs/resume-program-panel";
import { BlockProgressMeter } from "@/components/programs/block-progress-meter";
import { formatAppDate } from "@/lib/training/week";
import { plural, pluralWord } from "@/lib/utils/format";
import { MAX_PROGRAMS_PER_USER } from "@/lib/validation/program-builder";

export const metadata: Metadata = { title: "Programas" };

/** A shelf card's status chip: the running one in green, a draft in a neutral chip. */
const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Ativo", className: "tag tag--mark" },
  DRAFT: { label: "Rascunho", className: "tag tag--spec text-muted" },
  ARCHIVED: { label: "Arquivado", className: "tag tag--spec text-warning" },
};

export default async function ProgramsPage({ searchParams }: PageProps<"/app/programs">) {
  const user = await requireUser();
  const params = await searchParams;
  const deleted = params.excluido === "1";
  const limitReached = params.limite === "1";
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
      },
    }),
    listTemplates(),
    getProfile(user.id),
    getActiveEnrollment(user.id),
    // Where the GD series goes on (the next block after the one finished), or the program stopped mid-block.
    getSeriesContinuation(user.id),
  ]);
  // Completed-workout count per archived program, bounded to those ids on the
  // (programId, status) index (A-037): a relation _count aggregates the whole
  // WorkoutSession table on every /app/programs load.
  const archivedCompleted = archived.length
    ? await prisma.workoutSession.groupBy({
        by: ["programId"],
        where: { programId: { in: archived.map((p) => p.id) }, status: "COMPLETED" },
        _count: { _all: true },
      })
    : [];
  const completedByProgram = new Map(archivedCompleted.map((r) => [r.programId, r._count._all]));
  const archivedWithCounts = archived.map((p) => ({ ...p, _count: { sessions: completedByProgram.get(p.id) ?? 0 } }));
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
  const items: ProtocolCardData[] = catalog.map((t) => ({
    ...t,
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
    <Link href="/app/programs/new" className="card is-link group mt-4 flex items-center gap-4 p-4 sm:p-5">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
        <Plus className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold group-hover:text-accent">Monte seu próprio programa</span>
        <span className="mt-0.5 block text-sm text-muted">Do zero, ou abra um pronto e toque em “Personalizar”.</span>
      </span>
      <GArrow className="size-4 shrink-0 text-muted" />
    </Link>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Masthead
        kicker="Sua estante"
        title="Programas"
        // The principles every program is built on (the evidence library). Inline, so on a
        // narrow phone the arrow wraps with the last word instead of floating at the edge.
        lead={
          <Link href="/app/science" className="py-2 text-sm font-semibold text-accent hover:underline">
            Ciência dos{" "}
            <span className="whitespace-nowrap">
              programas
              <GArrow className="ml-1 inline-block size-3.5 align-[-2px]" />
            </span>
          </Link>
        }
        // Building from scratch is the hard path: it only leads once the user has programs.
        action={
          <Button variant={hasPrograms ? "strong" : "outline"} asChild className="shrink-0">
            <Link href="/app/programs/new">
              <Plus className="size-4" />
              Criar
            </Link>
          </Button>
        }
      />

      {deleted ? (
        <p
          role="status"
          className="mt-6 flex items-center gap-2 rounded-[var(--radius-md)] bg-success-soft px-4 py-3 text-sm font-medium text-success"
        >
          <GCheck className="size-4" />
          Programa excluído
        </p>
      ) : null}

      {limitReached ? (
        <p role="status" className="mt-6 rounded-[var(--radius-md)] bg-warning-soft px-4 py-3 text-sm text-foreground">
          Você atingiu o limite de {MAX_PROGRAMS_PER_USER} programas. Arquive ou exclua um para criar outro.
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
          <section className="@container mt-8">
            <SectionHead label="Meus programas" count={plural(myPrograms.length, "programa", "programas")} />
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 @xl:grid-cols-2">
              {myPrograms.map((p) => {
                const running = enrollment?.programId === p.id ? enrollment : null;
                const status = STATUS_LABEL[p.status];
                return (
                  <Link key={p.id} href={`/app/programs/${p.id}`} className="card is-link group flex min-w-0 flex-col p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 text-[17px] font-semibold leading-snug wrap-break-word">{p.name}</h3>
                      <span className={`${status.className} mt-0.5 shrink-0`}>{status.label}</span>
                    </div>
                    {running && progress ? (
                      // The running program says where it stands, not what its days are called.
                      <BlockProgressMeter progress={progress} className="mt-3" />
                    ) : p.days.length > 0 ? (
                      <p className="mt-auto pt-3 text-sm font-medium tabular-nums">
                        {[
                          `${p.daysPerWeek} ${pluralWord(p.daysPerWeek, "dia", "dias")}/semana`,
                          p.durationWeeks ? plural(p.durationWeeks, "semana", "semanas") : null,
                          plural(p.days.length, "treino", "treinos"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">Sem dias ainda</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {archivedWithCounts.length > 0 ? <ArchivedPrograms programs={archivedWithCounts} /> : null}

        {/* While nothing runs, a program stopped mid-block picks up where it was — ahead of a fresh pick. */}
        {continuation.resume && !enrollment ? <ResumeProgramPanel resume={continuation.resume} className="mt-8" /> : null}

        {/* The pick leads while nothing is running; with a program running, the filtered library is enough. */}
        {recommendations.length > 0 && !enrollment ? (
          <RecommendedPanel
            className={continuation.resume ? "mt-3" : "mt-8"}
            // Under "Retomar", a fresh start is the alternative: one primary action on the page.
            secondary={Boolean(continuation.resume)}
            fatLoss={answers?.goal === "FAT_LOSS"}
            picks={recommendations.slice(0, 3).map((r) => ({
              slug: r.template.slug,
              namePt: r.template.namePt,
              taglinePt: r.template.taglinePt,
              reasons: r.reasons,
              adapt: r.adapt,
            }))}
          />
        ) : null}
      </ProtocolLibrary>

      {hasPrograms ? null : (
        <section className="mt-12">
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
    <details className="group card mt-4" data-testid="archived-programs">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>Arquivados ({programs.length})</span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="flex flex-col divide-y divide-border border-t border-border px-4 sm:px-5">
        {programs.map((p) => {
          const completed = p.enrollments[0]?.status === "COMPLETED";
          const when = formatAppDate(p.archivedAt ?? p.updatedAt, { day: "2-digit", month: "short" }).replace(".", "");
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <Link href={`/app/programs/${p.id}`} className="min-w-0 flex-1 basis-40 hover:text-accent">
                <span className="block font-semibold leading-tight">{p.name}</span>
                <span className="mt-0.5 block text-[13px] tabular-nums text-muted">
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
