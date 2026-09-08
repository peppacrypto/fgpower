import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/require-user";
import { listTemplates } from "@/lib/data/templates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Programas" };

const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
};

export default async function PublicProgramsPage() {
  const session = await getCurrentSession();
  if (session) redirect("/app/programs");

  const templates = await listTemplates();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Biblioteca</p>
      <h1 className="text-display mt-2 max-w-xl text-4xl font-semibold">Programas</h1>
      <p className="mt-3 max-w-lg text-muted">
        Programas prontos, construídos em torno de evidência real — objetivo, frequência e progressão explicados,
        nunca só uma planilha de exercícios.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {templates.map((t) => (
          <Link key={t.id} href={`/programs/${t.slug}`}>
            <Card className="h-full transition-colors hover:border-accent/50">
              <CardContent className="flex h-full flex-col pt-6">
                {t.isFlagship ? (
                  <Badge variant="accent" className="mb-3 w-fit">
                    Programa em destaque
                  </Badge>
                ) : null}
                <h2 className="text-lg font-semibold">{t.namePt}</h2>
                <p className="mt-1.5 text-sm text-muted">{t.taglinePt}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                  <Badge>{GOAL_LABEL[t.goal] ?? t.goal}</Badge>
                  <Badge>{t.daysPerWeek}x/semana</Badge>
                  <Badge>{t.durationWeeks} semanas</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
