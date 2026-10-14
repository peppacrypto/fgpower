import Link from "next/link";
import { GArrow } from "@/components/ui/glyph";
import { GOAL_LABEL, EXPERIENCE_LABEL, GOAL_HUE, EQUIPMENT_SHORT_LABEL } from "@/lib/constants/program-labels";
import type { CatalogItem } from "@/lib/programming/catalog";
import { splitSeriesTagline } from "@/lib/programming/gd-series";
import { plural, pluralWord } from "@/lib/utils/format";

export interface ProtocolCardData extends CatalogItem {
  /** Kept for callers that still number their lists; the card no longer prints it. */
  index?: number | null;
  href: string;
  /** Tag on the featured card: "Para você" (top recommendation) or "Destaque" (flagship, logged out). */
  mark?: string | null;
}

/**
 * The weekly commitment, the line people compare programs by:
 * "3 dias/semana · ~60 min · 8 semanas".
 */
export function commitmentLine(t: Pick<CatalogItem, "daysPerWeek" | "sessionMinutes" | "durationWeeks">): string {
  return [
    `${t.daysPerWeek} ${pluralWord(t.daysPerWeek, "dia", "dias")}/semana`,
    `~${t.sessionMinutes} min`,
    plural(t.durationWeeks, "semana", "semanas"),
  ].join(" · ");
}

/**
 * A program in the library, built for comparing at a glance: its name (and a
 * "Destaque" / "Para você" mark), one line on what it builds, the weekly
 * commitment, then — quieter — its goal (a small colored dot), level and
 * where it's trained. The full session structure lives on the program's page.
 */
export function ProtocolCard({ data }: { data: ProtocolCardData }) {
  const hue = GOAL_HUE[data.goal] ?? GOAL_HUE.GENERAL_FITNESS;
  // A GD block's tagline leads with what it builds; its place in the series is on its page.
  const { outcome } = splitSeriesTagline(data.taglinePt);

  return (
    <Link href={data.href} className="card is-link group flex w-full min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[17px] font-semibold leading-snug wrap-break-word">{data.namePt}</h3>
        {data.mark ? <span className="tag tag--mark mt-0.5 shrink-0">{data.mark}</span> : null}
      </div>
      <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted wrap-break-word">{outcome}</p>

      {/* mt-auto: side by side in a grid row, the commitment lines align for comparing. */}
      <p className="mt-auto pt-3 text-sm font-medium tabular-nums text-foreground" data-commitment>
        {commitmentLine(data)}
      </p>
      {/* Level and where it's trained: 43 of 48 programs need a full gym, and a home user must see that here. */}
      <div className="mt-1.5 flex items-center gap-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span className="tag tag--field text-[13px]" style={{ color: hue.fg }}>
            {GOAL_LABEL[data.goal] ?? data.goal}
          </span>
          <span aria-hidden>·</span>
          <span>{EXPERIENCE_LABEL[data.experienceLevel] ?? data.experienceLevel}</span>
          <span aria-hidden>·</span>
          <span data-testid="card-equipment">{EQUIPMENT_SHORT_LABEL[data.equipmentAccess] ?? data.equipmentAccess}</span>
        </p>
        <GArrow className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
    </Link>
  );
}
