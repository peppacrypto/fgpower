import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { GArrow, GProgress } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { getExerciseBySlug, getProgramUsesBySlug, isFavoriteSlug, type ProgramUse } from "@/lib/data/exercises";
import { parseExerciseContent, parseInstructions } from "@/lib/exercises/content";
import { isTimedHold } from "@/lib/training/set-plan";
import { ExerciseFacts, ExerciseGuide, ExerciseSynthesis, exerciseKind } from "@/components/exercises/exercise-guide";
import { TechniqueFrames } from "@/components/exercises/technique-frames";
import { FavoriteButton } from "./favorite-button";
import { getCurrentSession } from "@/lib/auth/require-user";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

export async function generateMetadata({ params }: PageProps<"/app/exercises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const exercise = await getExerciseBySlug(slug);
  if (!exercise) return { title: NOT_FOUND_TITLE };
  return { title: exercise.namePt };
}

/** "Ver página completa" from the workout's technique sheet: `/app/workout/<id>?ex=<log>`, nothing else. */
const WORKOUT_RETURN = /^\/app\/workout\/[\w-]+(\?ex=[\w-]+)?$/;

export default async function ExerciseDetailPage({ params, searchParams }: PageProps<"/app/exercises/[slug]">) {
  const { slug } = await params;
  const from = (await searchParams).from;
  // Back to the same exercise of the open workout (W-025), not the library.
  const backToWorkout = typeof from === "string" && WORKOUT_RETURN.test(from) ? from : null;
  // The user's side (favorite, where it sits in their program) keys on the
  // slug, so it loads alongside the exercise instead of after it.
  const mine = getCurrentSession().then(async (session) => {
    if (!session) return null;
    const [favorited, uses] = await Promise.all([
      isFavoriteSlug(session.user.id, slug),
      getProgramUsesBySlug(session.user.id, slug),
    ]);
    return { favorited, uses };
  });
  const [exercise, user] = await Promise.all([getExerciseBySlug(slug), mine]);
  if (!exercise) notFound();

  const content = parseExerciseContent(exercise.contentPt);
  const instructions = parseInstructions(exercise.instructionsPt);
  const uses = user?.uses ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={backToWorkout ?? "/app/exercises"}
        className="-mt-2 -ml-1 mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backToWorkout ? "Voltar ao treino" : "Exercícios"}
      </Link>
      {/* Demonstration first; beside it (below it on a phone) what the exercise is, where it
          sits in the user's program, and the technique in short. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <TechniqueFrames
          name={exercise.namePt}
          media={exercise.media}
          videoUrl={exercise.videoUrl}
          videoCredit={exercise.videoCredit}
          stackWide
        />

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-display break-words text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">
                {exercise.namePt}
              </h1>
              <p className="mt-1.5 text-[15px] text-muted">{exerciseKind(exercise)}</p>
            </div>
            {user ? (
              <div className="flex shrink-0 items-center gap-2">
                <FavoriteButton exerciseId={exercise.id} initialFavorited={user.favorited} />
              </div>
            ) : null}
          </div>

          <ExerciseFacts exercise={exercise} />

          {uses.length > 0 ? <InYourProgram uses={uses} slug={exercise.slug} /> : null}

          {/* The way into this exercise's charts, records and sessions. */}
          <Button variant="outline" size="sm" asChild className="min-h-11 self-start">
            <Link href={`/app/exercises/${exercise.slug}/history`}>
              <GProgress className="size-4" />
              Meu histórico
            </Link>
          </Button>

          <ExerciseSynthesis content={content} />
        </div>
      </div>

      <ExerciseGuide
        exercise={exercise}
        content={content}
        instructions={instructions}
        relationHref={(s) => `/app/exercises/${s}`}
        className="mt-10 max-w-3xl"
      />
    </div>
  );
}

/**
 * "No seu programa": the days of the running program that do this exercise,
 * with their prescription — the page answers "how much do I do of it?".
 */
function InYourProgram({ uses, slug }: { uses: ProgramUse[]; slug: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-accent-soft px-4 py-3.5">
      <p className="text-[13px] text-muted">
        No seu programa · <span className="font-semibold text-foreground">{uses[0].programName}</span>
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
        {uses.map((u, i) => {
          const timed = isTimedHold({ slug, notes: u.notes });
          const reps = u.repMin === u.repMax ? `${u.repMin}` : `${u.repMin}-${u.repMax}`;
          return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{u.dayName}</span>
              <span className="text-sm font-semibold tabular-nums">
                {u.sets}×{reps}
                {timed ? " s" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/app/programs/${uses[0].programId}`}
        className="-mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        Ver programa
        <GArrow className="size-3.5" />
      </Link>
    </div>
  );
}
