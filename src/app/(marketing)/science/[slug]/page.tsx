import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";

const EVIDENCE_LEVEL_LABEL: Record<string, string> = {
  A: "A — Diretrizes / evidência sistemática forte",
  B: "B — Múltiplos estudos controlados",
  C: "C — Biomecânica ou evidência direta limitada",
  D: "D — Consenso de especialistas",
};

export async function generateMetadata({ params }: PageProps<"/science/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.trainingPrinciple.findUnique({ where: { slug } });
  return p ? { title: p.titlePt } : {};
}

export default async function PublicPrincipleDetailPage({ params }: PageProps<"/science/[slug]">) {
  const { slug } = await params;
  const session = await getCurrentSession();
  if (session) redirect(`/app/science/${slug}`);

  const principle = await prisma.trainingPrinciple.findUnique({
    where: { slug },
    include: { evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!principle) notFound();

  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-display text-3xl font-semibold sm:text-4xl">{principle.titlePt}</h1>
      <p className="mt-3 text-lg text-muted">{principle.summaryPt}</p>

      <div className="mt-8">
        <Markdown text={principle.bodyPt} />
      </div>

      {principle.evidence.length > 0 ? (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Referências</h2>
          <div className="flex flex-col gap-2">
            {principle.evidence.map((ev) => (
              <a
                key={ev.sourceId}
                href={ev.source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--radius-md)] border border-border p-3.5 text-sm hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ev.source.title}</p>
                    <p className="text-xs text-muted">
                      {ev.source.authors} · {ev.source.journal} · {ev.source.publicationYear}
                    </p>
                  </div>
                  <Badge variant="accent" className="shrink-0">
                    {ev.source.evidenceLevel}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted">{ev.source.abstractSummary}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-accent">
                  Ver fonte <ExternalLink className="size-3" />
                </span>
              </a>
            ))}
          </div>
          <ul className="mt-4 flex flex-col gap-0.5 text-[11px] text-muted">
            {Object.entries(EVIDENCE_LEVEL_LABEL).map(([level, label]) => (
              <li key={level}>{label}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
    </MarketingShell>
  );
}
