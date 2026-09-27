import Link from "next/link";
import { GArrow } from "@/components/ui/glyph";
import { GOAL_LABEL, EXPERIENCE_LABEL, STYLE_LABEL, GOAL_HUE } from "@/lib/constants/program-labels";
import type { CatalogItem } from "@/lib/programming/catalog";
import { dayTokens } from "@/lib/programming/day-tokens";
import { pluralWord } from "@/lib/utils/format";

export interface ProtocolCardData extends CatalogItem {
  /** The oversized numeral; null = none (a card shown ahead of a numbered list). */
  index: number | null;
  href: string;
  /** Tag on the featured card: "Para você" (top recommendation) or "Destaque" (flagship, logged out). */
  mark?: string | null;
}

/** A program rendered as a "protocol sheet": a hue-coded heavy top-rule "channel"
 * cap (not a boxed border), an oversized mono index, a split-map of its days, and
 * mono spec stats. Flat — grouping reads from the rule + tonal hover, no border/shadow. */
export function ProtocolCard({ data }: { data: ProtocolCardData }) {
  const hue = GOAL_HUE[data.goal] ?? GOAL_HUE.GENERAL_FITNESS;

  return (
    <Link
      href={data.href}
      className="group relative flex min-w-0 flex-col bg-surface p-5 pt-4 transition-colors hover:bg-[var(--ink-2)]"
      style={{ borderTop: `2px solid ${hue.spine}` }}
    >
      {/* oversized index, top-right */}
      {data.index !== null ? (
        <span
          className="pointer-events-none absolute right-4 top-3 font-mono text-5xl font-bold tabular-nums text-foreground/[0.06] transition-colors group-hover:text-foreground/10"
          aria-hidden
        >
          {String(data.index).padStart(2, "0")}
        </span>
      ) : null}

      {/* pr-14 keeps the tags clear of the index numeral */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pr-14">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          {STYLE_LABEL[data.trainingStyle] ?? "Programa"}
        </span>
        <span className="tag tag--field" style={{ color: hue.fg }}>
          {GOAL_LABEL[data.goal] ?? data.goal}
        </span>
        {data.mark ? <span className="tag tag--mark">{data.mark}</span> : null}
      </div>

      <h3 className="mt-2 max-w-[85%] text-lg font-bold leading-tight tracking-tight">{data.namePt}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{data.taglinePt}</p>

      {/* split map */}
      {data.dayNames.length > 0 ? <DayChips names={data.dayNames} className="mt-4" /> : null}

      {/* spec stats — hairline-divided, no box */}
      <div className="mt-4 flex items-stretch divide-x divide-border border-y border-border py-3 text-center">
        <Spec value={`${data.daysPerWeek}×`} label="/ semana" />
        <Spec value={String(data.durationWeeks)} label={pluralWord(data.durationWeeks, "semana", "semanas")} />
        <Spec value={`${data.sessionMinutes}′`} label="por sessão" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {EXPERIENCE_LABEL[data.experienceLevel]}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 group-hover:text-foreground">
          Ver programa
          <GArrow className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}

/** A program's days as short mono chips ("SEG · SUP A", "A", "PUSH A"), full names on hover. */
export function DayChips({ names, className }: { names: string[]; className?: string }) {
  const tokens = dayTokens(names);
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {tokens.map((token, i) => (
        <span
          key={i}
          title={names[i]}
          className="bg-surface-2 px-1.5 py-1 font-mono text-[10px] font-medium tracking-tight text-foreground/70"
        >
          {token}
        </span>
      ))}
    </div>
  );
}

function Spec({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center px-2">
      <span className="font-mono text-base font-bold tabular-nums leading-none">{value}</span>
      <span className="mt-1 text-[9px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}
