import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Ciência" };

export default async function ScienceIndexPage() {
  const principles = await prisma.trainingPrinciple.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Princípios científicos</h1>
      <p className="mt-1 text-sm text-muted">
        Os conceitos que sustentam a programação da FGPOWER, com as evidências reais por trás de cada um.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {principles.map((p) => (
          <Link key={p.id} href={`/app/science/${p.slug}`}>
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
