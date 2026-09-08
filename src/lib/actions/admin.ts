"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import type { ExerciseContent } from "@/lib/exercises/content";

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export interface ExerciseAdminUpdate {
  namePt: string;
  nameEn: string;
  isCurated: boolean;
  isPublished: boolean;
  setupPt: string;
  breathingPt: string;
  coachingCuesPt: string; // newline-separated
  commonMistakesPt: string; // newline-separated
  rangeOfMotionPt: string;
  whyThisExerciseExistsPt: string;
}

export async function updateExerciseAdmin(exerciseId: string, input: ExerciseAdminUpdate) {
  await requireAdminOrThrow();

  const contentPt: ExerciseContent | null = input.setupPt.trim()
    ? {
        setup: input.setupPt.trim(),
        breathing: input.breathingPt.trim(),
        coachingCues: linesToArray(input.coachingCuesPt),
        commonMistakes: linesToArray(input.commonMistakesPt),
        rangeOfMotion: input.rangeOfMotionPt.trim(),
        whyThisExerciseExists: input.whyThisExerciseExistsPt.trim(),
      }
    : null;

  await prisma.exercise.update({
    where: { id: exerciseId },
    data: {
      namePt: input.namePt,
      nameEn: input.nameEn,
      isCurated: input.isCurated,
      isPublished: input.isPublished,
      contentPt: contentPt as never,
    },
  });

  revalidatePath("/admin/exercises");
  revalidatePath(`/admin/exercises/${exerciseId}/edit`);
}

export async function linkExerciseEvidence(exerciseId: string, sourceKey: string, notePt: string) {
  await requireAdminOrThrow();
  const source = await prisma.evidenceSource.findUnique({ where: { key: sourceKey.trim() } });
  if (!source) throw new Error("EVIDENCE_SOURCE_NOT_FOUND");

  await prisma.exerciseEvidence.upsert({
    where: { exerciseId_sourceId: { exerciseId, sourceId: source.id } },
    create: { exerciseId, sourceId: source.id, notePt: notePt || null },
    update: { notePt: notePt || null },
  });
  revalidatePath(`/admin/exercises/${exerciseId}/edit`);
}

export async function unlinkExerciseEvidence(exerciseId: string, sourceId: string) {
  await requireAdminOrThrow();
  await prisma.exerciseEvidence.delete({ where: { exerciseId_sourceId: { exerciseId, sourceId } } });
  revalidatePath(`/admin/exercises/${exerciseId}/edit`);
}

export async function resolveReport(reportId: string, status: "REVIEWED" | "ACTIONED" | "DISMISSED", note: string) {
  const admin = await requireAdminOrThrow();
  await prisma.userReport.update({
    where: { id: reportId },
    data: { status, resolutionNote: note || null, resolvedById: admin.id, resolvedAt: new Date() },
  });
  revalidatePath("/admin/reports");
}
