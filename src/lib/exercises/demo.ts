/**
 * An exercise's own rendered figure, when it has one: media of kind ILLUSTRATION, a
 * looped muted video (mp4) or an animated image, or, for a static hold, a single still.
 * An exercise without one keeps its Início / Fim frames.
 */
export interface MediaLike {
  url: string;
  kind: string;
}

const FRAME_ORDER: Record<string, number> = { IMAGE_START: 0, IMAGE_END: 1 };

export interface ExerciseMediaParts<T extends MediaLike> {
  /** The figure to show large: animated, or a still for a hold. */
  demo: T | null;
  /** The frame shown instead of the animation to someone who asks for less motion. */
  still: T | null;
  /** The still frames, Início before Fim (a thumbnail may have put Fim first in the list). */
  frames: T[];
}

export function exerciseMediaParts<T extends MediaLike>(media: readonly T[]): ExerciseMediaParts<T> {
  const demo = media.find((m) => m.kind === "ILLUSTRATION") ?? null;
  const frames = media
    .filter((m) => m.kind !== "ILLUSTRATION")
    .slice()
    .sort((a, b) => (FRAME_ORDER[a.kind] ?? 2) - (FRAME_ORDER[b.kind] ?? 2));
  // The list's first item is the exercise's thumbnail, the frame that says what it is.
  const first = media.find((m) => m.kind !== "ILLUSTRATION") ?? null;
  return {
    demo,
    still: first,
    // A hold's demo is its only frame: showing it twice says nothing.
    frames: demo && frames.length === 1 && frames[0].url === demo.url ? [] : frames,
  };
}

/** The figure is a video: the newer renders are muted mp4 loops, the first ones animated webp. */
export function isVideoUrl(url: string): boolean {
  return /\.mp4(\?|$)/i.test(url);
}
