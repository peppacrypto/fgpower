import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { GArrow } from "@/components/ui/glyph";
import { SectionHead } from "@/components/ui/section-head";
import { Masthead } from "@/components/ui/masthead";

export const metadata: Metadata = { title: "Ciência" };

export default async function PublicScienceIndexPage() {
  const [session, principles] = await Promise.all([
    getCurrentSession(),
    prisma.trainingPrinciple.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (session) redirect("/app/science");

  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Masthead
          kicker="Metodologia"
          title="Princípios científicos"
          lead="Os conceitos que sustentam a programação da FGPOWER, com as evidências reais por trás de cada um."
        />

        <section className="mt-10">
          <SectionHead label="Princípios" count={String(principles.length)} />
          <div className="mt-4 flex flex-col gap-2">
            {principles.map((p) => (
              <Link key={p.id} href={`/science/${p.slug}`} className="card is-link group flex items-start gap-3 p-4 sm:p-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold leading-snug group-hover:text-accent">{p.titlePt}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{p.summaryPt}</span>
                </span>
                <GArrow className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
