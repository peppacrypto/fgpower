import { isVideoUrl } from "@/lib/exercises/demo";
import { cn } from "@/lib/utils/cn";

/** The figures' own background: a frame that shows more than the picture blends into it. */
export const FIGURE_BACKGROUND = "bg-[#0b0b0c]";

/**
 * The exercise's own figure, shown large: a muted looping video of the movement (or, for the first renders, an animated
 * image), or a still for a hold. The video plays by itself: browsers allow that when it is muted and inline. Someone who
 * asks for less motion sees the still frame instead and the video stays hidden. The files are already the size they are
 * shown at, and next/image would pass an animated file through untouched, so these are plain elements.
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
  if (isVideoUrl(src)) {
    return (
      <span data-exercise-demo className="block">
        <video
          src={src}
          poster={still ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          preload="metadata"
          aria-label={alt}
          width={800}
          height={600}
          className={cn("block w-full motion-reduce:hidden", className)}
        />
        {still ? (
          // Shown only to someone who asks for less motion: a plain file already at the size it is shown.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt={alt} width={800} height={600} decoding="async" className={cn("hidden w-full motion-reduce:block", className)} />
        ) : null}
      </span>
    );
  }
  return (
    <picture data-exercise-demo>
      {still && still !== src ? <source media="(prefers-reduced-motion: reduce)" srcSet={still} /> : null}
      <img src={src} alt={alt} width={640} height={480} decoding="async" className={cn("block w-full", className)} />
    </picture>
  );
}
