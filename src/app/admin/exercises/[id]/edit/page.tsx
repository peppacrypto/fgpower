import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseExerciseContent } from "@/lib/exercises/content";
import { ExerciseAdminForm } from "./exercise-admin-form";

export const metadata: Metadata = { title: "Editar exercício" };

export default async function AdminExerciseEditPage({ params }: PageProps<"/admin/exercises/[id]/edit">) {
  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: { evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!exercise) notFound();

  const content = parseExerciseContent(exercise.contentPt);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{exercise.namePt}</h1>
      <div className="mt-6 max-w-2xl">
        <ExerciseAdminForm
          exerciseId={exercise.id}
          initial={{
            namePt: exercise.namePt,
            nameEn: exercise.nameEn,
            isCurated: exercise.isCurated,
            isPublished: exercise.isPublished,
            setupPt: content?.setup ?? "",
            breathingPt: content?.breathing ?? "",
            coachingCuesPt: content?.coachingCues.join("\n") ?? "",
            commonMistakesPt: content?.commonMistakes.join("\n") ?? "",
            rangeOfMotionPt: content?.rangeOfMotion ?? "",
            whyThisExerciseExistsPt: content?.whyThisExerciseExists ?? "",
          }}
          evidenceLinks={exercise.evidence.map((e) => ({
            sourceId: e.sourceId,
            key: e.source.key,
            title: e.source.title,
            notePt: e.notePt,
          }))}
        />
      </div>
    </div>
  );
}
