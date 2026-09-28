import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getEnrollmentProgress, getUserProgram } from "@/lib/data/user-programs";
import { getActiveEnrollment } from "@/lib/data/dashboard";
import { getProgramRestart } from "@/lib/data/program-lifecycle";
import { discardDraft, startProgram } from "@/lib/actions/programs";
import { pickerExercisesByIds } from "@/app/api/exercises/picker-data";
import { ProgramBuilder } from "./program-builder";
import type { BuilderDay } from "@/lib/actions/program-builder";

export const metadata: Metadata = { title: "Editar programa" };

export default async function EditProgramPage({ params, searchParams }: PageProps<"/app/programs/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const program = await getUserProgram(id);
  if (!program || program.userId !== user.id) notFound();

  const exerciseIds = [...new Set(program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
  const [exercises, profile, activeEnrollment, openSession, trained, notes, restart] = await Promise.all([
    pickerExercisesByIds(exerciseIds),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { equipmentAccess: true } }),
    getActiveEnrollment(user.id),
    prisma.workoutSession.findFirst({
      where: { userId: user.id, programId: id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.workoutSession.count({ where: { userId: user.id, programId: id, status: { not: "DISCARDED" } } }),
    exerciseIds.length
      ? prisma.exerciseUserNote.findMany({
          where: { userId: user.id, exerciseId: { in: exerciseIds } },
          select: { exerciseId: true, note: true },
        })
      : Promise.resolve([]),
    program.status === "ACTIVE" ? Promise.resolve(null) : getProgramRestart(user.id, id),
  ]);
  // Starting this one while another runs is a switch: the builder's "Iniciar" asks first, naming it.
  const other = activeEnrollment && activeEnrollment.programId !== program.id ? activeEnrollment : null;
  const switchFrom = other ? { name: other.program.name, progress: await getEnrollmentProgress(other) } : null;

  const initialDays: BuilderDay[] = program.days.map((day) => ({
    id: day.id,
    name: day.name,
    focus: day.focus,
    exercises: day.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exercise.namePt,
      groupKey: ex.groupKey,
      sets: ex.sets,
      repMin: ex.repMin,
      repMax: ex.repMax,
      rirTarget: ex.rirTarget,
      restSeconds: ex.restSeconds,
      warmupSets: ex.warmupSets,
      loadTargetKg: ex.loadTargetKg,
      notes: ex.notes,
      rpeTarget: ex.rpeTarget,
      tempo: ex.tempo,
      progressionStrategy: ex.progressionStrategy,
      loadIncrementKg: ex.loadIncrementKg,
    })),
  }));

  const adapted = typeof query.adaptado === "string" ? Number.parseInt(query.adaptado, 10) : NaN;
  const notice =
    query.copia === "1"
      ? ({ kind: "copy" } as const)
      : Number.isFinite(adapted) && adapted >= 0
        ? ({ kind: "adapted", swaps: adapted } as const)
        : null;

  return (
    <ProgramBuilder
      programId={program.id}
      programName={program.name}
      programDescription={program.description ?? ""}
      programDaysPerWeek={program.daysPerWeek}
      programDurationWeeks={program.durationWeeks}
      initialDays={initialDays}
      version={program.updatedAt.toISOString()}
      status={program.status}
      sourceTemplate={program.sourceTemplate ? { name: program.sourceTemplate.namePt, slug: program.sourceTemplate.slug } : null}
      canDiscard={program.status === "DRAFT" && trained === 0}
      exercises={exercises}
      machineNotes={Object.fromEntries(notes.map((n) => [n.exerciseId, n.note]))}
      equipmentAccess={profile?.equipmentAccess ?? null}
      openSession={openSession}
      switchFrom={switchFrom}
      start={startProgram.bind(null, program.id)}
      // Stopped midway or finished: its page offers "Retomar da semana N" / the next block, not a restart at week 1.
      startFromPage={!!(restart?.resumable || restart?.completed)}
      discard={discardDraft.bind(null, program.id)}
      notice={notice}
    />
  );
}
