import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Info } from "lucide-react";
import { GArrow, GLoad } from "@/components/ui/glyph";
import { getCurrentSession, requireUser } from "@/lib/auth/require-user";
import { getEnrollmentProgress, getUserProgram } from "@/lib/data/user-programs";
import { getActiveEnrollment, getDaysDoneThisWeek, getInProgressSessions } from "@/lib/data/dashboard";
import { analyzeUserProgram } from "@/lib/programming/analyze";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  startProgram,
  archiveProgram,
  duplicateProgram,
  deleteUntrainedProgram,
  resumeProgram,
  switchToNextBlock,
} from "@/lib/actions/programs";
import { getProgramRestart } from "@/lib/data/program-lifecycle";
import { seriesBlockName, seriesPosition, splitSeriesTagline } from "@/lib/programming/gd-series";
import { prisma } from "@/lib/db";
import { DayActions, DayStatus, dayStates, exerciseCount } from "@/components/workout/day-actions";
import { SwitchProgramButton } from "@/components/programs/switch-program-button";
import { ProgramMenu } from "@/components/programs/program-menu";
import { LimitationsNote } from "@/components/programs/limitations-note";
import { getProfile } from "@/lib/data/profile";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";
import { deriveGroups, groupRule } from "@/lib/programming/groups";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({ params }: PageProps<"/app/programs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [program, session] = await Promise.all([getUserProgram(id), getCurrentSession()]);
  // Someone else's program is "not found" in the tab too, as on the page.
  return program && program.userId === session?.user.id ? { title: program.name } : { title: NOT_FOUND_TITLE };
}

export default async function UserProgramPage({ params }: PageProps<"/app/programs/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const program = await getUserProgram(id);
  if (!program || program.userId !== user.id) notFound();

  const [feedback, activeEnrollment, inProgress, profile, restart, trained] = await Promise.all([
    analyzeUserProgram(id),
    getActiveEnrollment(user.id),
    getInProgressSessions(user.id),
    getProfile(user.id),
    getProgramRestart(user.id, id),
    prisma.workoutSession.count({ where: { userId: user.id, programId: id, status: { not: "DISCARDED" } } }),
  ]);
  const limitations = profile?.limitations?.trim();
  const isActive = program.status === "ACTIVE";
  // A finished GD block leads on to the next one of the series.
  const nextSlug = restart.completed ? seriesPosition(program.sourceTemplate?.slug)?.nextSlug ?? null : null;
  const otherActive = activeEnrollment && activeEnrollment.programId !== program.id ? activeEnrollment : null;
  const ownEnrollment = activeEnrollment && activeEnrollment.programId === program.id ? activeEnrollment : null;
  const doneThisWeek = ownEnrollment
    ? (await getDaysDoneThisWeek(user.id, ownEnrollment.id, program.days)).byDayId
    : new Map<string, string>();
  // A workout left open on an earlier day (and untouched since) doesn't lock
  // the plan: Today offers to close it.
  const open = inProgress.filter((s) => !s.stale);
  const states = dayStates(program.days, open, doneThisWeek);
  const openWithData = open.find((s) => s.hasData);
  const hasExercises = program.days.some((d) => d.exercises.length > 0);
  const editHref = `/app/programs/${program.id}/edit`;
  // A copy of a GD block carries its tagline: led by the outcome, its place as a mono line.
  const description = program.description ? splitSeriesTagline(program.description) : null;
  // Where the running program stands, for the switch and archive warnings.
  const activeProgress = activeEnrollment ? await getEnrollmentProgress(activeEnrollment) : null;
  const switchingFrom = otherActive ? { name: otherActive.program.name, progress: activeProgress ?? "" } : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
            <Badge variant={isActive || restart.completed ? "accent" : program.status === "DRAFT" ? "default" : "warning"}>
              {isActive
                ? "Ativo"
                : restart.completed && program.status === "ARCHIVED"
                  ? "Concluído"
                  : program.status === "DRAFT"
                    ? "Rascunho"
                    : "Arquivado"}
            </Badge>
          </div>
          {program.sourceTemplate ? (
            <p className="mt-1 text-sm text-muted">
              Baseado em{" "}
              <Link href={`/app/programs/templates/${program.sourceTemplate.slug}`} className="text-accent underline underline-offset-2">
                {program.sourceTemplate.namePt}
              </Link>
            </p>
          ) : null}
          {description ? (
            <>
              {description.meta ? (
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  {description.meta}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted wrap-break-word">{description.outcome}</p>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-start gap-2">
        {!isActive && hasExercises && restart.resumable ? (
          // Stopped midway: pick it up where it was, or start it over.
          <>
            <SwitchProgramButton
              action={resumeProgram.bind(null, program.id)}
              label={`Retomar da semana ${restart.resumable.week}`}
              switchLabel={`Retomar da semana ${restart.resumable.week}`}
              pendingLabel="Retomando…"
              size="md"
              active={switchingFrom}
            />
            <SwitchProgramButton
              action={startProgram.bind(null, program.id)}
              label="Recomeçar"
              switchLabel="Recomeçar"
              pendingLabel="Iniciando…"
              size="md"
              variant="outline"
              active={switchingFrom}
            />
          </>
        ) : !isActive && hasExercises && restart.completed ? (
          // Finished: the next block of the series, or the same one again.
          <>
            {nextSlug ? (
              <SwitchProgramButton
                action={switchToNextBlock.bind(null, restart.completed.enrollmentId)}
                label={`Começar ${seriesBlockName(nextSlug)}`}
                switchLabel={`Começar ${seriesBlockName(nextSlug)}`}
                pendingLabel="Ativando…"
                size="md"
                active={switchingFrom}
              />
            ) : null}
            <SwitchProgramButton
              action={startProgram.bind(null, program.id)}
              label="Repetir bloco"
              switchLabel="Repetir bloco"
              pendingLabel="Iniciando…"
              size="md"
              variant={nextSlug ? "outline" : "strong"}
              active={switchingFrom}
            />
          </>
        ) : !isActive && hasExercises ? (
          <SwitchProgramButton
            action={startProgram.bind(null, program.id)}
            label="Iniciar este programa"
            pendingLabel="Iniciando…"
            size="md"
            active={switchingFrom}
          />
        ) : null}
        {!isActive && !hasExercises ? (
          <Button disabled aria-describedby="start-needs-exercises">
            Iniciar este programa
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={`/app/programs/${program.id}/edit`}>Editar</Link>
        </Button>
        <div className="ml-auto">
          <ProgramMenu
            duplicate={duplicateProgram.bind(null, program.id)}
            archive={
              program.status === "ARCHIVED"
                ? null
                : {
                    action: archiveProgram.bind(null, program.id),
                    active: ownEnrollment ? { progress: activeProgress ?? "" } : null,
                  }
            }
            remove={!isActive && trained === 0 ? deleteUntrainedProgram.bind(null, program.id) : null}
          />
        </div>
      </div>

      {!isActive && !hasExercises ? (
        <p id="start-needs-exercises" className="mt-2 text-xs text-muted">
          Adicione ao menos um exercício para iniciar.{" "}
          <Link href={editHref} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
            Editar programa
          </Link>
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

      {limitations ? (
        <LimitationsNote
          text={limitations}
          fix={<>Algum exercício não serve para você? Toque em “Editar” para trocá-lo.</>}
        />
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {program.days.map((day) => (
          <div key={day.id} className="reg-frame p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="min-w-[7rem] flex-1">
                <h3 className="font-semibold wrap-break-word">{day.name}</h3>
                {isActive ? (
                  <p className="text-xs text-muted">
                    {exerciseCount(day.exercises.length)}
                    <DayStatus state={states.get(day.id) ?? { kind: "idle" }} suggested={false} />
                  </p>
                ) : null}
              </div>
              {isActive ? (
                <DayActions
                  dayId={day.id}
                  state={states.get(day.id) ?? { kind: "idle" }}
                  locked={!!openWithData}
                  editHref={day.exercises.length === 0 ? editHref : undefined}
                />
              ) : null}
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {day.exercises.map((ex, j, list) => {
                // Supersets (W-104): an accent rule down the members, "A1" before each name.
                const slot = deriveGroups(list)[j];
                return (
                  <li key={ex.id} data-group={slot?.label} className={cn(slot && "border-l-2 border-l-accent pl-2")}>
                    {slot?.first ? (
                      <p className="pt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                        {groupRule(slot)}
                      </p>
                    ) : null}
                    <Link href={`/app/exercises/${ex.exercise.slug}`} className="group flex min-h-12 items-center gap-3 py-1.5 text-sm">
                      <div className="relative size-9 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
                        {ex.exercise.media?.[0]?.url ? (
                          <Image src={ex.exercise.media[0].url} alt="" fill sizes="36px" className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted">
                            <GLoad className="size-4" />
                          </div>
                        )}
                      </div>
                      {/* Whole, however many lines: names differ at the end ("… Pegada Média" / "… Pegada
                          Aberta"), and at 320px even three lines cut GD's longer ones ("Extensão de Tríceps na
                          Corda Acima da Cabeça"). The catalog's longest name is 71 characters. */}
                      <span className="min-w-0 flex-1 leading-snug wrap-break-word group-hover:text-accent">
                        {slot ? (
                          <span className="mr-1.5 font-mono text-[11px] font-bold text-accent">
                            <span aria-hidden>{slot.label}</span>
                            <span className="sr-only">{`${slot.heading}, ${slot.position} de ${slot.size}:`}</span>
                          </span>
                        ) : null}
                        {ex.exercise.namePt}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-muted">
                        {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                      </span>
                      <GArrow className="size-3.5 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
