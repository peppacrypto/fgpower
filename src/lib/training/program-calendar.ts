import { wallClock } from "./week";

/**
 * The GD plan's official order (approved 2026-09-27): Adaptação → GD 1 … GD 8.
 * Finishing one block offers the next; the last one offers repeating it.
 */
export const GD_SERIES = [
  "gd-adaptacao",
  "gd-1",
  "gd-2",
  "gd-3",
  "gd-4",
  "gd-5",
  "gd-6",
  "gd-7",
  "gd-8",
] as const;

export interface SeriesPosition {
  /** 1-based block number within the series. */
  index: number;
  total: number;
  previousSlug: string | null;
  nextSlug: string | null;
}

/** Where a template sits in the GD series, or null for programs outside it. */
export function seriesPosition(slug: string | null | undefined): SeriesPosition | null {
  if (!slug) return null;
  const i = (GD_SERIES as readonly string[]).indexOf(slug);
  if (i < 0) return null;
  return {
    index: i + 1,
    total: GD_SERIES.length,
    previousSlug: i > 0 ? GD_SERIES[i - 1] : null,
    nextSlug: i < GD_SERIES.length - 1 ? GD_SERIES[i + 1] : null,
  };
}

/**
 * A program activated from Thursday on (São Paulo) starts "today", but that
 * short entry week doesn't count toward the program's duration (approved
 * 2026-09-27): its weekly target is what's left of the week.
 */
export function isPartialEntryWeek(activatedAt: Date): boolean {
  const weekday = wallClock(activatedAt).weekday; // 0 = Sunday
  return weekday === 0 || weekday >= 4;
}
