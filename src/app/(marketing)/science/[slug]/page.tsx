import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { Markdown, splitTakeaway } from "@/components/markdown";
import { SectionHead } from "@/components/ui/section-head";
import { EvidenceReferences } from "@/components/ui/evidence-references";

/** One principle with its references — shared by generateMetadata and the page (one query per request). */
const getPrinciple = cache((slug: string) =>
  prisma.trainingPrinciple.findUnique({
    where: { slug },
    include: { evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } } },
  }),
);

export async function generateMetadata({ params }: PageProps<"/science/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPrinciple(slug);
  return p ? { title: p.titlePt } : {};
}

export default async function PublicPrincipleDetailPage({ params }: PageProps<"/science/[slug]">) {
  const { slug } = await params;
  const [session, principle] = await Promise.all([getCurrentSession(), getPrinciple(slug)]);
  if (session) redirect(`/app/science/${slug}`);
  if (!principle) notFound();

  // Editorial order: the summary, then the practical upshot, then the evidence in detail.
  const { takeaway, body } = splitTakeaway(principle.bodyPt);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/science"
          className="-mt-2 -ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Princípios científicos
        </Link>
        <h1 className="text-display mt-3 text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]">{principle.titlePt}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{principle.summaryPt}</p>

        {takeaway ? (
          <div className="mt-6 rounded-[var(--radius-lg)] bg-accent-soft p-4 sm:p-5">
            <p className="eyebrow text-accent">Para o seu treino</p>
            <Markdown text={takeaway} className="mt-1.5 text-[15px] leading-relaxed text-foreground sm:text-base" />
          </div>
        ) : null}

        <section aria-labelledby={takeaway ? "em-detalhe" : undefined} className={takeaway ? "mt-10" : "mt-8"}>
          {takeaway ? <SectionHead id="em-detalhe" label="Em detalhe" /> : null}
          <Markdown
            text={body}
            className={`max-w-prose text-[15px] leading-relaxed text-foreground sm:text-base ${takeaway ? "mt-3" : ""}`}
          />
        </section>

        <EvidenceReferences items={principle.evidence} className="mt-12" />
      </article>
    </MarketingShell>
  );
}
