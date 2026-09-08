import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getUserProgram } from "@/lib/data/user-programs";
import { ProgramBuilder } from "./program-builder";
import type { BuilderDay } from "@/lib/actions/program-builder";

export const metadata: Metadata = { title: "Editar programa" };

export default async function EditProgramPage({ params }: PageProps<"/app/programs/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser();
  const program = await getUserProgram(id);
  if (!program || program.userId !== user.id) notFound();

  const initialDays: BuilderDay[] = program.days.map((day) => ({
    name: day.name,
    focus: day.focus,
    exercises: day.exercises.map((ex) => ({
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
    })),
  }));

  return (
    <ProgramBuilder
      programId={program.id}
      programName={program.name}
      programDescription={program.description ?? ""}
      initialDays={initialDays}
    />
  );
}
