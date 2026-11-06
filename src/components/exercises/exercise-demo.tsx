import { cn } from "@/lib/utils/cn";

/** The figures' own background: a frame that shows more than the picture blends into it. */
export const FIGURE_BACKGROUND = "bg-[#0b0b0c]";

/**
 * The exercise's own figure, shown large: a looped animation of the movement, or
 * a still for a hold. Someone who asks for less motion gets the still frame in its
 * place, and the animation is not downloaded. The file is already the size it is
 * shown at and next/image would pass an animated file through untouched, so this
 * is a plain <img>.
 */
export function ExerciseDemo({
  src,
  still,
  alt,
  className,
}: {
  src: string;
  still?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <picture data-exercise-demo>
      {still && still !== src ? <source media="(prefers-reduced-motion: reduce)" srcSet={still} /> : null}
      <img src={src} alt={alt} width={640} height={480} decoding="async" className={cn("block w-full", className)} />
    </picture>
  );
}
