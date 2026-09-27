import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import { listTemplatesUsingPrinciple, recommendProfileOf, toCatalogItem } from "@/lib/data/templates";
import { recommendTemplates } from "@/lib/programming/recommend";
import { beginnerStep, nextPrinciple, BEGINNER_PATH } from "@/lib/programming/principle-order";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { GArrow } from "@/components/ui/glyph";
import { SectionHead } from "@/components/ui/section-head";
import { ProtocolCard } from "@/components/programs/protocol-card";
import { plural } from "@/lib/utils/format";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

/** Programs shown under "Na prática". */
const IN_PRACTICE = 3;

const EVIDENCE_LEVEL_LABEL: Record<string, string> = {
  A: "A — Diretrizes / evidência sistemática forte",
  B: "B — Múltiplos estudos controlados",
  C: "C — Biomecânica ou evidência direta limitada",
  D: "D — Consenso de especialistas",
};

export async function generateMetadata({ params }: PageProps<"/app/science/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.trainingPrinciple.findUnique({ where: { slug } });
  return p ? { title: p.titlePt } : { title: NOT_FOUND_TITLE };
}

export default async function PrincipleDetailPage({ params }: PageProps<"/app/science/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const [principle, all, profile] = await Promise.all([
    prisma.trainingPrinciple.findUnique({
      where: { slug },
      include: { evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.trainingPrinciple.findMany({ select: { slug: true, titlePt: true, summaryPt: true, sortOrder: true } }),
    getProfile(user.id),
  ]);
  if (!principle) notFound();

  // "Na prática": programs built on this principle — the ones that fit the user first.
  const using = (await listTemplatesUsingPrinciple(principle.id)).map(toCatalogItem);
  const answers = recommendProfileOf(profile);
  const fitting = answers ? recommendTemplates(answers, using).map((r) => r.template) : [];
  const practice = [...fitting, ...using.filter((t) => !fitting.includes(t))].slice(0, IN_PRACTICE);
  const next = nextPrinciple(all, principle.slug);
  const step = beginnerStep(principle.slug);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/app/science"
        className="-mt-2 inline-flex items-center gap-1 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground"
      >
        {step ? `Comece aqui · ${step} de ${BEGINNER_PATH.length}` : "Princípios científicos"}
      </Link>
      <h1 className="text-display mt-1 text-3xl font-extrabold sm:text-4xl">{principle.titlePt}</h1>
      <p className="mt-2 text-muted">{principle.summaryPt}</p>

      <div className="mt-6">
        <Markdown text={principle.bodyPt} />
      </div>

      {practice.length > 0 ? (
        <section className="mt-10">
          <SectionHead label="Na prática" count={plural(using.length, "programa", "programas")} />
          <p className="mt-1.5 text-xs text-muted">
            Programas que aplicam este princípio{answers ? " — os que mais combinam com você primeiro" : ""}.
          </p>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {practice.map((t, i) => (
              <ProtocolCard
                key={t.slug}
                data={{ ...t, index: i + 1, href: `/app/programs/templates/${t.slug}`, mark: null }}
              />
            ))}
          </div>
        </section>
      ) : null}

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
                className="reg-frame is-link p-3.5 text-sm"
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
                <p className="mt-2 text-xs text-muted">{ev.source.summaryPt ?? ev.source.abstractSummary}</p>
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

      <Link
        href={next ? `/app/science/${next.slug}` : "/app/science"}
        className="reg-frame is-link group mt-10 flex items-center gap-3 p-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            {next ? "Próximo princípio" : "Fim da leitura"}
          </span>
          <span className="mt-1 block font-semibold group-hover:text-accent">
            {next ? next.titlePt : "Todos os princípios"}
          </span>
          {next ? <span className="mt-0.5 block line-clamp-2 text-sm text-muted">{next.summaryPt}</span> : null}
        </span>
        <GArrow className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
