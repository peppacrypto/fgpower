import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Info } from "lucide-react";
import { GArrow, GCheck, GLoad } from "@/components/ui/glyph";
import { getCurrentSession, requireUser } from "@/lib/auth/require-user";
import { getEnrollmentProgress, getUserProgram } from "@/lib/data/user-programs";
import { getActiveEnrollment, getDaysDoneThisWeek, getInProgressSessions } from "@/lib/data/dashboard";
import { trackOf } from "@/lib/programming/tracks";
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
import { blockingGear } from "@/lib/exercises/gear";
import { GYM_ADJUST_LABEL, gearBlockingAny, gearListPt, missingGearFlag } from "@/lib/programming/equipment-needs";
import { cn } from "@/lib/utils/cn";
import { plural, pluralWord } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/app/programs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [program, session] = await Promise.all([getUserProgram(id), getCurrentSession()]);
  // Someone else's program is "not found" in the tab too, as on the page.
  return program && program.userId === session?.user.id ? { title: program.name } : { title: NOT_FOUND_TITLE };
}

/**
 * Back from "Ajustar à minha academia" (actions/program-gear applyGymStandIns):
 * how many exercises it swapped, from `?academia=N`; null on any other visit.
 */
function adjustedCount(value: string | string[] | undefined): number | null {
  return typeof value === "string" && /^\d{1,3}$/.test(value) ? Number(value) : null;
}

export default async function UserProgramPage({ params, searchParams }: PageProps<"/app/programs/[id]">) {
  const { id } = await params;
  const adjusted = adjustedCount((await searchParams).academia);
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
  // "Outro programa ativo" (the switch warning) only counts an active plan in
  // the SAME track: a yoga / mobility program starts alongside the primary
  // plan, so viewing it must not warn that it will replace the GD plan.
  const programTrack = trackOf(program.goal);
  const otherActive =
    activeEnrollment &&
    activeEnrollment.programId !== program.id &&
    trackOf(activeEnrollment.program.goal) === programTrack
      ? activeEnrollment
      : null;
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
  // The weekly demand, as the library cards say it: "5 dias/semana · ~55 min · 13 semanas · 5 treinos".
  const minutes = program.days.map((d) => d.estimatedMinutes).filter((m): m is number => m != null && m > 0);
  const demand = [
    `${program.daysPerWeek} ${pluralWord(program.daysPerWeek, "dia", "dias")}/semana`,
    minutes.length > 0 ? `~${Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)} min` : null,
    program.durationWeeks ? plural(program.durationWeeks, "semana", "semanas") : null,
    program.days.length > 0 ? plural(program.days.length, "treino", "treinos") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Where the running program stands, for the switch and archive warnings.
  const activeProgress = activeEnrollment ? await getEnrollmentProgress(activeEnrollment) : null;
  const switchingFrom = otherActive ? { name: otherActive.program.name, progress: activeProgress ?? "" } : null;
  // The gym (Settings → Minha academia): each exercise whose every apparatus it
  // lacks is flagged ("Sem aparelho: Hack") and the notice offers the review
  // that swaps them in this program (/academia). Only read when gear is missing.
  const missingGear = profile?.missingGear ?? [];
  const gearOf =
    missingGear.length > 0 && hasExercises
      ? await prisma.exercise.findMany({
          where: { id: { in: [...new Set(program.days.flatMap((d) => d.exercises.map((ex) => ex.exerciseId)))] } },
          select: { id: true, slug: true, equipmentId: true },
        })
      : [];
  const blocked = new Map(gearOf.map((ex) => [ex.id, blockingGear(ex, missingGear)] as const).filter(([, gear]) => gear.length > 0));
  const lackedGear = gearBlockingAny(gearOf.filter((ex) => blocked.has(ex.id)), missingGear);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {adjusted !== null ? (
        <p
          role="status"
          className="mb-5 flex items-center gap-2 rounded-[var(--radius-md)] bg-success-soft px-4 py-3 text-sm font-medium text-success"
        >
          <GCheck className="size-4 shrink-0" />
          {adjusted > 0
            ? `Programa ajustado à sua academia: ${plural(adjusted, "exercício trocado", "exercícios trocados")}.`
            : "Nenhuma troca salva — o programa segue como estava."}
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-display min-w-0 text-[1.75rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[2rem]">
              {program.name}
            </h1>
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
            <p className="mt-1.5 text-sm text-muted">
              Baseado em{" "}
              <Link
                href={`/app/programs/templates/${program.sourceTemplate.slug}`}
                className="font-medium text-accent underline decoration-1 underline-offset-2"
              >
                {program.sourceTemplate.namePt}
              </Link>
            </p>
          ) : null}
          {description ? (
            <>
              {description.meta ? <p className="mt-1.5 text-[13px] font-medium text-muted">{description.meta}</p> : null}
              <p className="mt-1 text-[15px] leading-snug text-muted wrap-break-word">{description.outcome}</p>
            </>
          ) : null}
          {demand ? <p className="mt-3 text-sm font-medium tabular-nums">{demand}</p> : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-start gap-2 border-b border-border pb-5">
        {!isActive && hasExercises && restart.resumable ? (
          // Stopped midway: pick it up where it was, or start it over.
          <>
            <SwitchProgramButton
              action={resumeProgram.bind(null, program.id)}
              label={restart.resumable.week === 0 ? "Retomar · semana de entrada" : `Retomar da semana ${restart.resumable.week}`}
              switchLabel={restart.resumable.week === 0 ? "Retomar · semana de entrada" : `Retomar da semana ${restart.resumable.week}`}
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
            label="Ativar este programa"
            pendingLabel="Ativando…"
            size="md"
            active={switchingFrom}
          />
        ) : null}
        {!isActive && !hasExercises ? (
          <Button disabled aria-describedby="start-needs-exercises">
            Ativar este programa
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

      {restart?.resumable?.endedByDurationEdit ? (
        <p className="mt-3 text-[13px] text-muted">
          Você encurtou a duração e o bloco foi encerrado. Retome de onde parou quando quiser.
        </p>
      ) : null}

      {!isActive && !hasExercises ? (
        <p id="start-needs-exercises" className="mt-3 text-[13px] text-muted">
          Adicione ao menos um exercício para iniciar.{" "}
          <Link href={editHref} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
            Editar programa
          </Link>
        </p>
      ) : null}

      {blocked.size > 0 ? (
        <div className="mt-6 rounded-[var(--radius-lg)] bg-warning-soft p-4 sm:p-5" data-testid="gym-adjust-panel">
          <p className="tag tag--status tag--warn text-[13px] font-semibold">Sua academia não tem: {gearListPt(lackedGear)}</p>
          <p className="mt-1.5 text-[15px] leading-snug text-foreground">
            {plural(blocked.size, "exercício deste programa usa", "exercícios deste programa usam")}{" "}
            {lackedGear.length === 1 ? "esse aparelho" : "esses aparelhos"}. Dá para{" "}
            {blocked.size === 1 ? "trocá-lo por outro" : "trocá-los por outros"} do mesmo músculo e movimento, com o que a
            sua academia tem — você confere cada troca antes de salvar.
          </p>
          <Button asChild variant="strong" className="mt-3">
            <Link href={`/app/programs/${program.id}/academia`}>{GYM_ADJUST_LABEL}</Link>
          </Button>
        </div>
      ) : null}

      {feedback.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          {feedback.map((f) => (
            <div
              key={f.code}
              className="card flex items-start gap-2.5 px-3.5 py-3 text-sm"
            >
              {f.severity === "notice" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-muted" />
              )}
              <span className="text-foreground/90">{f.messagePt}</span>
            </div>
          ))}
          <p className="text-[13px] text-muted">Isso é uma orientação, não uma proibição.</p>
        </div>
      ) : null}

      {isActive && openWithData ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-lg)] bg-warning-soft px-4 py-3 text-sm text-foreground">
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
          <div key={day.id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="min-w-[7rem] flex-1">
                <h3 className="text-base font-semibold leading-snug wrap-break-word">{day.name}</h3>
                {isActive ? (
                  <p className="mt-0.5 text-[13px] text-muted">
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
                const gearFlag = missingGearFlag(blocked.get(ex.exerciseId) ?? []);
                return (
                  <li key={ex.id} data-group={slot?.label} className={cn(
                      slot && "-mx-2 bg-accent-soft/40 px-2",
                      slot?.first && "rounded-t-[var(--radius-md)]",
                      slot?.last && "rounded-b-[var(--radius-md)]",
                    )}
                  >
                    {slot?.first ? (
                      <p className="pt-2 text-[13px] font-semibold text-accent">
                        {groupRule(slot)}
                      </p>
                    ) : null}
                    <Link href={`/app/exercises/${ex.exercise.slug}`} className="group flex min-h-12 items-center gap-3 py-1.5 text-sm">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
                        {ex.exercise.media?.[0]?.url ? (
                          <Image src={ex.exercise.media[0].url} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted">
                            <GLoad className="size-4" />
                          </div>
                        )}
                      </div>
                      {/* Whole, however many lines: names differ at the end ("… Pegada Média" / "… Pegada
                          Aberta"), and at 320px even three lines cut GD's longer ones ("Extensão de Tríceps na
                          Corda Acima da Cabeça"). The catalog's longest name is 71 characters. */}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] leading-snug wrap-break-word group-hover:text-accent">
                          {slot ? (
                            <span className="mr-1.5 font-semibold tabular-nums text-accent">
                              <span aria-hidden>{slot.label}</span>
                              <span className="sr-only">{`${slot.heading}, ${slot.position} de ${slot.size}:`}</span>
                            </span>
                          ) : null}
                          {ex.exercise.namePt}
                        </span>
                        {gearFlag ? (
                          <Badge variant="warning" className="mt-1" data-testid="gear-flag">
                            {gearFlag}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[13px] font-medium tabular-nums text-muted">
                        {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                      </span>
                      <GArrow className="size-4 shrink-0 text-muted" />
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
