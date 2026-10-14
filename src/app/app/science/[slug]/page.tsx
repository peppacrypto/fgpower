import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import { listTemplatesUsingPrinciple, recommendProfileOf, toCatalogItem } from "@/lib/data/templates";
import { recommendTemplates } from "@/lib/programming/recommend";
import { beginnerStep, nextPrinciple, BEGINNER_PATH } from "@/lib/programming/principle-order";
import { Markdown, splitTakeaway } from "@/components/markdown";
import { ChevronLeft } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { SectionHead } from "@/components/ui/section-head";
import { EvidenceReferences } from "@/components/ui/evidence-references";
import { ProtocolCard } from "@/components/programs/protocol-card";
import { plural } from "@/lib/utils/format";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

/** Programs shown under "Na prática". */
const IN_PRACTICE = 3;

/** One principle with its references — shared by generateMetadata and the page (one query per request). */
const getPrinciple = cache((slug: string) =>
  prisma.trainingPrinciple.findUnique({
    where: { slug },
    include: { evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } } },
  }),
);

export async function generateMetadata({ params }: PageProps<"/app/science/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPrinciple(slug);
  return p ? { title: p.titlePt } : { title: NOT_FOUND_TITLE };
}

export default async function PrincipleDetailPage({ params }: PageProps<"/app/science/[slug]">) {
  const { slug } = await params;
  // One round: each loader starts as soon as what it needs is known.
  const principleP = getPrinciple(slug);
  const [principle, all, profile, listed] = await Promise.all([
    principleP,
    prisma.trainingPrinciple.findMany({ select: { slug: true, titlePt: true, summaryPt: true, sortOrder: true } }),
    requireUser().then((user) => getProfile(user.id)),
    principleP.then((p) => (p ? listTemplatesUsingPrinciple(p.id) : [])),
  ]);
  if (!principle) notFound();

  // "Na prática": programs built on this principle — the ones that fit the user first.
  const using = listed.map(toCatalogItem);
  const answers = recommendProfileOf(profile);
  const fitting = answers ? recommendTemplates(answers, using).map((r) => r.template) : [];
  const practice = [...fitting, ...using.filter((t) => !fitting.includes(t))].slice(0, IN_PRACTICE);
  const next = nextPrinciple(all, principle.slug);
  const step = beginnerStep(principle.slug);
  // Editorial order: the summary, then the practical upshot, then the evidence in detail.
  const { takeaway, body } = splitTakeaway(principle.bodyPt);

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/app/science"
        className="-mt-2 -ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Princípios científicos
      </Link>
      {step ? (
        <p className="eyebrow mt-3 text-accent">
          Comece aqui · {step} de {BEGINNER_PATH.length}
        </p>
      ) : null}
      <h1 className={`text-display text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem] ${step ? "mt-0.5" : "mt-3"}`}>
        {principle.titlePt}
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-muted">{principle.summaryPt}</p>

      {takeaway ? (
        <div className="mt-6 rounded-[var(--radius-lg)] bg-accent-soft p-4 sm:p-5">
          <p className="eyebrow text-accent">Para o seu treino</p>
          <Markdown text={takeaway} className="mt-1.5 text-[15px] leading-relaxed text-foreground sm:text-base" />
        </div>
      ) : null}

      <section aria-labelledby={takeaway ? "em-detalhe" : undefined} className={takeaway ? "mt-10" : "mt-8"}>
        {takeaway ? <SectionHead id="em-detalhe" label="Em detalhe" /> : null}
        <Markdown text={body} className={`max-w-prose text-[15px] leading-relaxed text-foreground sm:text-base ${takeaway ? "mt-3" : ""}`} />
      </section>

      {practice.length > 0 ? (
        <section className="mt-12">
          <SectionHead label="Na prática" count={plural(using.length, "programa", "programas")} />
          <p className="mt-1 text-[13px] text-muted">
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

      <EvidenceReferences items={principle.evidence} className="mt-12" />

      <Link
        href={next ? `/app/science/${next.slug}` : "/app/science"}
        className="card is-link group mt-12 flex items-center gap-3 p-4 sm:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">{next ? "Próximo princípio" : "Fim da leitura"}</span>
          <span className="mt-0.5 block text-base font-semibold group-hover:text-accent">
            {next ? next.titlePt : "Todos os princípios"}
          </span>
          {next ? <span className="mt-1 block line-clamp-2 text-sm text-muted">{next.summaryPt}</span> : null}
        </span>
        <GArrow className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}
