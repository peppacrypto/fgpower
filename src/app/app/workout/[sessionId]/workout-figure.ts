/**
 * The exercise's figure on the workout screen (its demonstration loop, under
 * the exercise's line, every exercise that has one): how tall it stands, and
 * this device's memory of it for the loading skeleton (figure-bone.tsx).
 *
 * A move done with no equipment keeps the large figure it always had (it is
 * often learned at home, with no one to copy). Every other move shows it a
 * notch smaller, so the first set stays within a short scroll on a small
 * phone. Sizes follow the screen's height, so the skeleton's bone, drawn with
 * the same classes, stands exactly as tall. Shared by the server skeleton
 * and the client, so no "use client".
 */
export type WorkoutFigureSize = "large" | "compact";

export const FIGURE_HEIGHT: Record<WorkoutFigureSize, string> = {
  large: "h-[clamp(150px,24dvh,220px)]",
  compact: "h-[clamp(112px,18dvh,180px)]",
};

export function figureSizeFor(equipmentId: string | null | undefined): WorkoutFigureSize {
  return equipmentId === "bodyweight" || equipmentId === "none" ? "large" : "compact";
}

/**
 * The figure a reopened workout lands on, as `<sessionId>.<L|C|N>`: kept as a
 * workout pref (localStorage, read by the skeleton a client navigation draws)
 * and in a small cookie that loading.tsx reads for the skeleton a reload
 * streams — as the "Você informou" note's room is (limitations-echo).
 */
export const WORKOUT_FIGURE_PREF = "workout-figure";
export const WORKOUT_FIGURE_COOKIE = "fg-wf";
export const WORKOUT_FIGURE_COOKIE_PATH = "/app/workout";

/** Unknown (another workout, a new device): nine in ten exercises of the programs have a figure. */
const USUAL: WorkoutFigureSize = "compact";

const CODE: Record<string, WorkoutFigureSize | null> = { L: "large", C: "compact", N: null };

export function encodeFigureMemory(sessionId: string, size: WorkoutFigureSize | null): string {
  return `${sessionId}.${size === "large" ? "L" : size === "compact" ? "C" : "N"}`;
}

/**
 * The room the skeleton keeps: the figure this device last knew the workout
 * would land on, when it is that workout (or the workout can't be told, as on
 * the server); otherwise the usual one.
 */
export function boneFigure(raw: string | null | undefined, sessionId: string | null): WorkoutFigureSize | null {
  const match = typeof raw === "string" ? /^([A-Za-z0-9_-]{1,64})\.([LCN])$/.exec(raw) : null;
  if (!match) return USUAL;
  if (sessionId !== null && match[1] !== sessionId) return USUAL;
  return CODE[match[2]];
}
