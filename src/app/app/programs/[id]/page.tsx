import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Info } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getUserProgram } from "@/lib/data/user-programs";
import { getActiveEnrollment, getDaysDoneThisWeek, getInProgressSessions } from "@/lib/data/dashboard";
import { analyzeUserProgram } from "@/lib/programming/analyze";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { startProgram, archiveProgram, duplicateProgram } from "@/lib/actions/programs";
import { DayActions, DayStatus, dayStates } from "@/components/workout/day-actions";

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

  const [feedback, activeEnrollment, inProgress] = await Promise.all([
    analyzeUserProgram(id),
    getActiveEnrollment(user.id),
    getInProgressSessions(user.id),
  ]);
  const isActive = program.status === "ACTIVE";
  const otherActive = activeEnrollment && activeEnrollment.programId !== program.id ? activeEnrollment : null;
  const ownEnrollment = activeEnrollment && activeEnrollment.programId === program.id ? activeEnrollment : null;
  const doneThisWeek = ownEnrollment
    ? (await getDaysDoneThisWeek(user.id, ownEnrollment.id, program.days)).byDayId
    : new Map<string, string>();
  const states = dayStates(program.days, inProgress, doneThisWeek);
  const openWithData = inProgress.find((s) => s.hasData);

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
            <SubmitButton pendingLabel="Iniciando…">Iniciar este programa</SubmitButton>
          </form>
        ) : null}
        <form action={duplicateProgram.bind(null, program.id)}>
          <SubmitButton variant="outline" pendingLabel="Duplicando…">
            Duplicar
          </SubmitButton>
        </form>
        {program.status !== "ARCHIVED" ? (
          <form action={archiveProgram.bind(null, program.id)}>
            <SubmitButton variant="ghost" pendingLabel="Arquivando…">
              Arquivar
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {!isActive && otherActive ? (
        <p className="mt-2 text-xs text-muted">
          Iniciar este programa encerra seu programa ativo atual (
          <span className="font-medium text-foreground">{otherActive.program.name}</span>).
        </p>
      ) : null}

      {feedback.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          {feedback.map((f) => (
            <div
              key={f.code}
              className="reg-frame flex items-start gap-2.5 px-3.5 py-3 text-sm"
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

      {isActive && openWithData ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-l-2 border-l-warning! bg-warning-soft px-3 py-2 text-xs text-foreground/90">
          <p className="min-w-0 flex-1">
            Você tem um treino em andamento: <span className="font-semibold">{openWithData.name}</span>. Finalize ou
            descarte-o para iniciar outro dia.
          </p>
          <Button asChild className="px-3.5">
            <Link href={`/app/workout/${openWithData.id}`}>Continuar</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {program.days.map((day) => (
          <div key={day.id} className="reg-frame p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="min-w-[7rem] flex-1">
                <h3 className="font-semibold wrap-break-word">{day.name}</h3>
                {isActive ? (
                  <p className="text-xs text-muted">
                    {day.exercises.length} exercícios
                    <DayStatus state={states.get(day.id) ?? { kind: "idle" }} suggested={false} />
                  </p>
                ) : null}
              </div>
              {isActive ? (
                <DayActions dayId={day.id} state={states.get(day.id) ?? { kind: "idle" }} locked={!!openWithData} />
              ) : null}
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {day.exercises.map((ex) => (
                <li key={ex.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
                    {ex.exercise.media?.[0]?.url ? (
                      <Image src={ex.exercise.media[0].url} alt="" fill sizes="36px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted">
                        <GLoad className="size-4" />
                      </div>
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate">{ex.exercise.namePt}</span>
                  <span className="shrink-0 font-mono tabular-nums text-muted">
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
