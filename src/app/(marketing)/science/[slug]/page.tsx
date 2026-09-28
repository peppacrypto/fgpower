import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { Markdown } from "@/components/markdown";
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

  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/science"
          className="-mt-2 -ml-1 inline-flex min-h-11 items-center gap-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Princípios científicos
        </Link>
        <h1 className="text-display mt-1 text-3xl font-semibold sm:text-4xl">{principle.titlePt}</h1>
        <p className="mt-3 text-lg text-muted">{principle.summaryPt}</p>

        <div className="mt-8">
          <Markdown text={principle.bodyPt} />
        </div>

        <EvidenceReferences items={principle.evidence} className="mt-10 border-t border-border pt-6" />
      </div>
    </MarketingShell>
  );
}
