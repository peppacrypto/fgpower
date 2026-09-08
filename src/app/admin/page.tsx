import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const [users, exercises, curated, templates, evidence, openReports] = await Promise.all([
    prisma.user.count(),
    prisma.exercise.count(),
    prisma.exercise.count({ where: { isCurated: true } }),
    prisma.workoutTemplate.count(),
    prisma.evidenceSource.count(),
    prisma.userReport.count({ where: { status: "OPEN" } }),
  ]);

  const stats = [
    { label: "Usuários", value: users, href: null },
    { label: "Exercícios", value: exercises, href: "/admin/exercises" },
    { label: "Exercícios curados", value: curated, href: "/admin/exercises?curated=1" },
    { label: "Programas", value: templates, href: null },
    { label: "Fontes científicas", value: evidence, href: null },
    { label: "Denúncias abertas", value: openReports, href: "/admin/reports" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Painel admin</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const content = (
            <Card className={s.href ? "transition-colors hover:border-accent/50" : ""}>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted">{s.label}</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href as never}>
              {content}
            </Link>
          ) : (
            <div key={s.label}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
