import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getUserProgram } from "@/lib/data/user-programs";
import { analyzeUserProgram } from "@/lib/programming/analyze";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startProgram, archiveProgram, duplicateProgram } from "@/lib/actions/programs";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";

export async function generateMetadata({ params }: PageProps<"/app/programs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const program = await getUserProgram(id);
  return program ? { title: program.name } : {};
}

export default async function UserProgramPage({ params }: PageProps<"/app/programs/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const program = await getUserProgram(id);
  if (!program || program.userId !== user.id) notFound();

  const feedback = await analyzeUserProgram(id);
  const isActive = program.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
            <Badge variant={isActive ? "accent" : program.status === "DRAFT" ? "default" : "warning"}>
              {isActive ? "Ativo" : program.status === "DRAFT" ? "Rascunho" : "Arquivado"}
            </Badge>
          </div>
          {program.sourceTemplate ? (
            <p className="mt-1 text-sm text-muted">
              Baseado em{" "}
              <Link href={`/app/programs/templates/${program.sourceTemplate.slug}`} className="text-accent hover:underline">
                {program.sourceTemplate.namePt}
              </Link>
            </p>
          ) : null}
          {program.description ? <p className="mt-1 text-sm text-muted">{program.description}</p> : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={`/app/programs/${program.id}/edit`}>Editar</Link>
        </Button>
        {!isActive ? (
          <form action={startProgram.bind(null, program.id)}>
            <Button type="submit">Iniciar este programa</Button>
          </form>
        ) : null}
        <form action={duplicateProgram.bind(null, program.id)}>
          <Button type="submit" variant="outline">
            Duplicar
          </Button>
        </form>
        {program.status !== "ARCHIVED" ? (
          <form action={archiveProgram.bind(null, program.id)}>
            <Button type="submit" variant="ghost">
              Arquivar
            </Button>
          </form>
        ) : null}
      </div>

      {feedback.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          {feedback.map((f) => (
            <div
              key={f.code}
              className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 py-3 text-sm"
            >
              {f.severity === "notice" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-muted" />
              )}
              <span className="text-foreground/90">{f.messagePt}</span>
            </div>
          ))}
          <p className="text-xs text-muted">Isso é uma orientação, não uma proibição.</p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {program.days.map((day) => (
          <div key={day.id} className="rounded-[var(--radius-md)] border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{day.name}</h3>
              {isActive ? (
                <form action={startAdHocWorkoutSession.bind(null, day.id)}>
                  <Button type="submit" size="sm">
                    Iniciar
                  </Button>
                </form>
              ) : null}
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
              {day.exercises.map((ex) => (
                <li key={ex.id} className="flex justify-between">
                  <span>{ex.exercise.namePt}</span>
                  <span className="font-mono tabular-nums">
                    {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
