/**
 * The order to read the science library in. A beginner starts with what the
 * first weeks feel like and the two ideas every workout uses (RIR and double
 * progression); everything else follows in the library's own order.
 */
export const BEGINNER_PATH = ["beginner-adaptation", "rir", "double-progression", "progressive-overload", "warm-up"];

export function readingOrder<T extends { slug: string; sortOrder: number }>(principles: T[]): T[] {
  const path = BEGINNER_PATH.map((slug) => principles.find((p) => p.slug === slug)).filter((p): p is T => Boolean(p));
  const rest = principles.filter((p) => !BEGINNER_PATH.includes(p.slug)).sort((a, b) => a.sortOrder - b.sortOrder);
  return [...path, ...rest];
}

/** The principle after `slug` in reading order, or null at the end. */
export function nextPrinciple<T extends { slug: string; sortOrder: number }>(principles: T[], slug: string): T | null {
  const order = readingOrder(principles);
  const i = order.findIndex((p) => p.slug === slug);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

/** "Comece aqui" position (1-based) of a principle, or null when it isn't on the beginner path. */
export function beginnerStep(slug: string): number | null {
  const i = BEGINNER_PATH.indexOf(slug);
  return i >= 0 ? i + 1 : null;
}
