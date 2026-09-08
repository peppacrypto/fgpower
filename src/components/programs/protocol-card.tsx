import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GOAL_LABEL, EXPERIENCE_LABEL, STYLE_LABEL, GOAL_HUE } from "@/lib/constants/program-labels";

export interface ProtocolCardData {
  index: number;
  href: string;
  namePt: string;
  taglinePt: string;
  goal: string;
  experienceLevel: string;
  trainingStyle: string;
  daysPerWeek: number;
  durationWeeks: number;
  sessionMinutes: number;
  dayNames: string[];
  isFlagship?: boolean;
}

/** Abbreviate a day name to a compact split-map token: "Push A" -> "PUSH·A", "Sessão A" -> "A". */
function splitToken(name: string): string {
  const cleaned = name.replace(/^(sess(ã|a)o|dia|day|treino)\s+/i, "").trim();
  return cleaned.length <= 10 ? cleaned.toUpperCase() : cleaned.slice(0, 9).toUpperCase() + "…";
}

/** A program rendered as a "protocol sheet": colored spine, oversized mono index, a split-map of its days, and mono spec stats. */
export function ProtocolCard({ data }: { data: ProtocolCardData }) {
  const hue = GOAL_HUE[data.goal] ?? GOAL_HUE.GENERAL_FITNESS;

  return (
    <Link
      href={data.href}
      className="group relative flex overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-all hover:border-border-strong hover:shadow-md"
    >
      {/* colored spine */}
      <span
        className="w-1 shrink-0 transition-all group-hover:w-1.5"
        style={{ background: hue.spine }}
        aria-hidden
      />

      <div className="relative min-w-0 flex-1 p-5">
        {/* oversized index, top-right */}
        <span
          className="pointer-events-none absolute right-4 top-2 font-mono text-5xl font-bold tabular-nums text-foreground/[0.06]"
          aria-hidden
        >
          {String(data.index).padStart(2, "0")}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {STYLE_LABEL[data.trainingStyle] ?? "Protocolo"}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: hue.bg, color: hue.fg }}
          >
            {GOAL_LABEL[data.goal] ?? data.goal}
          </span>
          {data.isFlagship ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-foreground">
              Destaque
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 max-w-[85%] text-lg font-bold leading-tight tracking-tight">{data.namePt}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{data.taglinePt}</p>

        {/* split map */}
        {data.dayNames.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1">
            {data.dayNames.map((d, i) => (
              <span
                key={i}
                className="rounded-[4px] bg-surface-2 px-1.5 py-1 font-mono text-[10px] font-medium tracking-tight text-foreground/70"
              >
                {splitToken(d)}
              </span>
            ))}
          </div>
        ) : null}

        {/* spec stats */}
        <div className="mt-4 flex items-stretch divide-x divide-border border-y border-border py-3 text-center">
          <Spec value={`${data.daysPerWeek}×`} label="/ semana" />
          <Spec value={String(data.durationWeeks)} label="semanas" />
          <Spec value={`${data.sessionMinutes}′`} label="por sessão" />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {EXPERIENCE_LABEL[data.experienceLevel]}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 group-hover:text-foreground">
            Ver protocolo
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function Spec({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center px-3">
      <span className="font-mono text-base font-bold tabular-nums leading-none">{value}</span>
      <span className="mt-1 text-[9px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}
