import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { TechniqueFrames } from "@/components/exercises/technique-frames";
import { ExerciseFacts, ExerciseGuide, ExerciseSynthesis, exerciseKind } from "@/components/exercises/exercise-guide";
import { getCurrentSession } from "@/lib/auth/require-user";
import { getExerciseBySlug } from "@/lib/data/exercises";
import { parseExerciseContent, parseInstructions } from "@/lib/exercises/content";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/exercises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const exercise = await getExerciseBySlug(slug);
  return exercise ? { title: exercise.namePt } : {};
}

export default async function PublicExerciseDetailPage({ params }: PageProps<"/exercises/[slug]">) {
  const { slug } = await params;
  const [session, exercise] = await Promise.all([getCurrentSession(), getExerciseBySlug(slug)]);
  if (session) redirect(`/app/exercises/${slug}`);
  if (!exercise) notFound();

  const content = parseExerciseContent(exercise.contentPt);
  const instructions = parseInstructions(exercise.instructionsPt);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/exercises"
          className="-mt-2 -ml-1 mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Exercícios
        </Link>
        {/* Demonstration first; beside it (below it on a phone) what the exercise is and the technique in short. */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <TechniqueFrames
            name={exercise.namePt}
            media={exercise.media}
            videoUrl={exercise.videoUrl}
            videoCredit={exercise.videoCredit}
            stackWide
          />

          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <h1 className="text-display break-words text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">
                {exercise.namePt}
              </h1>
              <p className="mt-1.5 text-[15px] text-muted">{exerciseKind(exercise)}</p>
            </div>

            <ExerciseFacts exercise={exercise} />

            <ExerciseSynthesis content={content} />

            <div className="rounded-[var(--radius-lg)] bg-accent-soft p-4">
              <p className="text-sm text-foreground">Entre para favoritar e acompanhar seu progresso neste exercício.</p>
              <Button variant="primary" size="sm" className="mt-3" asChild>
                <Link href="/login">
                  Continuar com Google
                  <GArrow className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <ExerciseGuide
          exercise={exercise}
          content={content}
          instructions={instructions}
          relationHref={(s) => `/exercises/${s}`}
          className="mt-10 max-w-3xl"
        />
      </div>
    </MarketingShell>
  );
}
