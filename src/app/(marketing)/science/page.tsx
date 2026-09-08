import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Ciência" };

export default async function PublicScienceIndexPage() {
  const session = await getCurrentSession();
  if (session) redirect("/app/science");

  const principles = await prisma.trainingPrinciple.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Metodologia</p>
      <h1 className="text-display mt-2 text-4xl font-semibold">Princípios científicos</h1>
      <p className="mt-3 max-w-lg text-muted">
        Os conceitos que sustentam a programação da FGPOWER, com as evidências reais por trás de cada um.
      </p>

      <div className="mt-10 flex flex-col gap-3">
        {principles.map((p) => (
          <Link key={p.id} href={`/science/${p.slug}`}>
            <Card className="transition-colors hover:border-accent/50">
              <CardContent className="pt-5">
                <h2 className="font-semibold">{p.titlePt}</h2>
                <p className="mt-1 text-sm text-muted">{p.summaryPt}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
