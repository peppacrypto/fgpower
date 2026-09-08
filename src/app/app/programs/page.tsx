import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { listTemplates } from "@/lib/data/templates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Programas" };

const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
};

const STATUS_LABEL: Record<string, { label: string; variant: "accent" | "default" | "warning" }> = {
  ACTIVE: { label: "Ativo", variant: "accent" },
  DRAFT: { label: "Rascunho", variant: "default" },
  ARCHIVED: { label: "Arquivado", variant: "warning" },
};

export default async function ProgramsPage() {
  const user = await requireUser();
  const [myPrograms, templates] = await Promise.all([
    prisma.userProgram.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { updatedAt: "desc" },
      include: { days: { select: { id: true } } },
    }),
    listTemplates(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programas</h1>
          <p className="mt-1 text-sm text-muted">Escolha um programa pronto ou monte o seu.</p>
        </div>
        <Button asChild>
          <Link href="/app/programs/new">
            <Plus className="size-4" />
            Criar programa
          </Link>
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Meus programas</h2>
        {myPrograms.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-8" />}
            title="Você ainda não tem programas"
            description="Comece a partir de um programa pronto abaixo, ou crie o seu do zero."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myPrograms.map((p) => (
              <Link key={p.id} href={`/app/programs/${p.id}`}>
                <Card className="h-full transition-colors hover:border-accent/50">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      <Badge variant={STATUS_LABEL[p.status].variant}>{STATUS_LABEL[p.status].label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {p.days.length} dias · {p.daysPerWeek}x/semana
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Biblioteca de programas</h2>
        {templates.length === 0 ? (
          <EmptyState title="Nenhum programa disponível ainda" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <Link key={t.id} href={`/app/programs/templates/${t.slug}`}>
                <Card className="h-full transition-colors hover:border-accent/50">
                  <CardContent className="flex h-full flex-col pt-5">
                    {t.isFlagship ? (
                      <Badge variant="accent" className="mb-2 w-fit">
                        Programa em destaque
                      </Badge>
                    ) : null}
                    <h3 className="font-bold">{t.namePt}</h3>
                    <p className="mt-1 text-sm text-muted">{t.taglinePt}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                      <Badge>{GOAL_LABEL[t.goal] ?? t.goal}</Badge>
                      <Badge>{t.daysPerWeek}x/semana</Badge>
                      <Badge>{t.durationWeeks} semanas</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
