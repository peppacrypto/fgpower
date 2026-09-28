import { EXPERIENCE_LABEL } from "@/lib/constants/program-labels";
import { GD_SERIES, seriesPosition } from "@/lib/training/program-calendar";

/**
 * How the GD plan (one 2-year series of 9 blocks: Adaptação → GD 1 … GD 8,
 * lib/training/program-calendar.ts) is presented: its blocks' short labels,
 * their taglines led by the outcome, and the rail the library card and each
 * block's dossier draw. Pure, and safe in client components.
 */

export { GD_SERIES, seriesPosition };

export function isGdSeries(slug: string | null | undefined): boolean {
  return seriesPosition(slug) !== null;
}

/** The rail's segment label: "A" for the Adaptação, "1"…"8" for GD 1…8. */
export function seriesShortLabel(slug: string): string {
  return slug === "gd-adaptacao" ? "A" : slug.replace(/^gd-/, "");
}

/** The block's name as a sentence says it: "GD Adaptação", "GD 3". */
export function seriesBlockName(slug: string): string {
  return slug === "gd-adaptacao" ? "GD Adaptação" : `GD ${slug.replace(/^gd-/, "")}`;
}

/**
 * The block's level as the plan's ramp reads it. The catalog tags GD 1
 * "Iniciante" (anyone who already trains may start there), but in the series
 * it comes after the Adaptação, for its graduates: "Pós-Adaptação". Other
 * blocks (and any program outside the series) keep the catalog's label.
 */
export function seriesLevelLabel(slug: string, experienceLevel: string): string {
  if (isPostAdaptation(slug, experienceLevel)) return "Pós-Adaptação";
  return EXPERIENCE_LABEL[experienceLevel] ?? experienceLevel;
}

/** A beginner-tagged GD block after the Adaptação (GD 1): a step up the ramp from it. */
export function isPostAdaptation(slug: string, experienceLevel: string): boolean {
  return experienceLevel === "BEGINNER" && isGdSeries(slug) && slug !== GD_SERIES[0];
}

/**
 * A slash-joined run ("Empurrar/Puxar/Pernas/Superior/Inferior") is one
 * unbreakable word to the browser, clipped on a 320px screen: let it wrap
 * after each slash (a zero-width space; nothing changes where it fits).
 */
export function wrapSlashes(text: string): string {
  return text.replace(/(\p{L})\/(?=\p{L})/gu, "$1/\u200B");
}

const TAGLINE = /^Bloco\s+(\d+)\s+de\s+(\d+)\s*·\s*semanas?\s+[\d–-]+\s*\((?:mês|meses)\s+([^)]+)\)\s*:\s*([\s\S]+)$/;

/**
 * A GD tagline leads with its place in the series ("Bloco 2 de 9 · semanas
 * 5-17 (meses 2-4): base de hipertrofia…"), which cut the benefit off on the
 * cards. Split it: the outcome to lead with, and the place as a mono meta
 * line ("Bloco 2 de 9 · meses 2-4"). Any other tagline comes back as is. For
 * display: slash-joined words may wrap (wrapSlashes).
 */
export function splitSeriesTagline(tagline: string): { outcome: string; meta: string | null } {
  const m = tagline.trim().match(TAGLINE);
  if (!m) return { outcome: wrapSlashes(tagline), meta: null };
  const [, index, total, months, rest] = m;
  const outcome = rest.trim();
  const plural = /[-–,]/.test(months) ? "meses" : "mês";
  return {
    outcome: wrapSlashes(outcome.charAt(0).toLocaleUpperCase("pt-BR") + outcome.slice(1)),
    meta: `Bloco ${index} de ${total} · ${plural} ${months.trim()}`,
  };
}

export interface SeriesBlock {
  slug: string;
  /** Rail label: "A", "1"…"8". */
  short: string;
  /** "GD Adaptação", "GD 3". */
  name: string;
  durationWeeks: number;
  experienceLevel: string;
  /** The level as the ramp reads it (seriesLevelLabel): "Pós-Adaptação" for GD 1. */
  levelLabel: string;
  /** First and last week of the plan the block covers (1-based, cumulative). */
  fromWeek: number;
  toWeek: number;
  /** 1 or 2: the year of the plan the block starts in. */
  year: number;
  href: string;
}

/**
 * The series' blocks in order, from whatever templates are listed (a block
 * missing from the catalog is left out), with the weeks each covers. Year 2
 * starts with the first block that begins after week 52.
 */
export function seriesBlocks(
  templates: readonly { slug: string; durationWeeks: number; experienceLevel: string }[],
  hrefFor: (slug: string) => string,
): SeriesBlock[] {
  const bySlug = new Map(templates.map((t) => [t.slug, t]));
  const blocks: SeriesBlock[] = [];
  let week = 1;
  for (const slug of GD_SERIES) {
    const t = bySlug.get(slug);
    if (!t) continue;
    const fromWeek = week;
    week += Math.max(1, t.durationWeeks);
    blocks.push({
      slug,
      short: seriesShortLabel(slug),
      name: seriesBlockName(slug),
      durationWeeks: t.durationWeeks,
      experienceLevel: t.experienceLevel,
      levelLabel: seriesLevelLabel(slug, t.experienceLevel),
      fromWeek,
      toWeek: week - 1,
      year: fromWeek > 52 ? 2 : 1,
      href: hrefFor(slug),
    });
  }
  return blocks;
}

/** Where a newcomer should enter the series: someone new to lifting in the Adaptação, anyone who trains in GD 1. */
export function seriesEntryFor(experience: string | null | undefined): "gd-adaptacao" | "gd-1" {
  return !experience || experience === "BEGINNER" ? "gd-adaptacao" : "gd-1";
}
