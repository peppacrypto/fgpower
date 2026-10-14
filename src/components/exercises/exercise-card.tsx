import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
import { cn } from "@/lib/utils/cn";
import type { ExerciseCard as ExerciseCardData } from "@/lib/data/exercises";

const DIFFICULTY_LABEL: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

type CardMedia = { url: string; width?: number | null; height?: number | null };

/**
 * An exercise in a list: its photo, name, main muscle · equipment, level.
 *
 * Every photo sits in the same 4:3 frame. Most technique photos are 3:2
 * landscapes, which a 4:3 cover trims by a few percent at the sides only —
 * the whole body and the equipment stay in (a lifter lying on a bench
 * included). A portrait photo would lose half its height to a cover crop, so
 * it is shown whole, over a soft blur of itself, in the same frame. The name
 * area reserves two lines so a row of cards lines up.
 *
 * `compact`: below sm the card is a list row (thumbnail, name, muscle,
 * equipment) — the library on a phone; from sm up it is the grid card.
 */
export function ExerciseCard({
  exercise,
  href,
  compact = false,
}: {
  exercise: Omit<ExerciseCardData, "media"> & { media: CardMedia[] };
  href?: string;
  compact?: boolean;
}) {
  const media = exercise.media[0];
  const portrait = Boolean(media?.width && media?.height && media.height > media.width);
  const primaryMuscle = exercise.muscles[0]?.muscle;
  const sizes = compact
    ? "(max-width: 639px) 96px, (max-width: 1279px) 34vw, 280px"
    : "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 280px";

  const content = (
    <div
      className={cn(
        "card is-link group flex h-full overflow-hidden",
        compact ? "items-center gap-3 p-2 pr-3 sm:flex-col sm:items-stretch sm:gap-0 sm:p-0" : "flex-col",
      )}
    >
      <div
        className={cn(
          "relative aspect-[4/3] shrink-0 overflow-hidden bg-surface-2",
          compact ? "w-24 rounded-[var(--radius-md)] sm:w-full sm:rounded-none" : "w-full",
        )}
      >
        {media ? (
          <>
            {portrait ? (
              <Image
                src={media.url}
                alt=""
                aria-hidden
                fill
                sizes={sizes}
                className="scale-125 object-cover blur-xl brightness-75"
              />
            ) : null}
            <Image
              src={media.url}
              // Decorative here: the name is the card's heading right below.
              alt=""
              fill
              sizes={sizes}
              className={portrait ? "object-contain" : "object-cover"}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <GLoad className={compact ? "size-6 sm:size-8" : "size-8"} />
          </div>
        )}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", compact ? "py-1 sm:p-4 sm:pt-3.5" : "p-3.5 sm:p-4 sm:pt-3.5")}>
        {/* A-034: no clamp — grip/position variants differ only at the end of the name,
            and a clamp also clips names under the WCAG 1.4.12 text-spacing overrides.
            Two lines are reserved so the cards of a row line up. */}
        <h3
          className={cn(
            "text-[15px] font-semibold leading-snug wrap-break-word",
            compact ? "sm:min-h-[2lh]" : "min-h-[2lh]",
          )}
        >
          {exercise.namePt}
        </h3>
        {primaryMuscle || exercise.equipment ? (
          <p className="text-[13px] leading-snug text-muted">
            {[primaryMuscle?.namePt, exercise.equipment?.namePt].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <p className={cn("flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug text-muted", !compact && "mt-auto pt-1", compact && "sm:mt-auto sm:pt-1")}>
          <span>{DIFFICULTY_LABEL[exercise.difficulty] ?? exercise.difficulty}</span>
          {exercise.isCurated ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Check aria-hidden className="size-3.5 text-accent" strokeWidth={2.5} />
                Guia completo
              </span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block h-full rounded-[var(--radius-lg)]">
      {content}
    </Link>
  );
}
