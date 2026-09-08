import Image from "next/image";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ExerciseCard as ExerciseCardData } from "@/lib/data/exercises";

const DIFFICULTY_LABEL: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

export function ExerciseCard({ exercise, href }: { exercise: ExerciseCardData; href?: string }) {
  const media = exercise.media[0];
  const primaryMuscle = exercise.muscles[0]?.muscle;

  const content = (
    <div className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-colors hover:border-accent/50">
      <div className="relative aspect-[4/3] w-full bg-surface-2">
        {media ? (
          <Image
            src={media.url}
            alt={exercise.namePt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <Dumbbell className="size-8" />
          </div>
        )}
        {exercise.isCurated ? (
          <Badge variant="accent" className="absolute left-2 top-2">
            Curado
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{exercise.namePt}</h3>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted">
          {primaryMuscle ? <span>{primaryMuscle.namePt}</span> : null}
          {exercise.equipment ? (
            <>
              <span aria-hidden>·</span>
              <span>{exercise.equipment.namePt}</span>
            </>
          ) : null}
        </div>
        <Badge variant="default" className="mt-1 w-fit">
          {DIFFICULTY_LABEL[exercise.difficulty] ?? exercise.difficulty}
        </Badge>
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}
