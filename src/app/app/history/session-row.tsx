import { Fragment } from "react";
import Link from "next/link";
import { Lettermark } from "@/components/ui/glyph";
import { Card, CardContent } from "@/components/ui/card";
import { formatAppDate } from "@/lib/training/week";
import { formatDuration, formatVolume, plural } from "@/lib/utils/format";

export interface HistorySession {
  id: string;
  name: string;
  finishedAt: Date | null;
  durationSeconds: number | null;
  totalWorkingSets: number | null;
  totalVolumeKg: number | null;
  recordCount: number;
}

/**
 * One finished workout in the history lists: its name and day, then what it
 * was — duration, working sets, volume — with a PR mark when it broke records.
 * Opens the workout's summary.
 */
export function SessionRow({ session: s, dateStyle = "full" }: { session: HistorySession; dateStyle?: "full" | "weekday" }) {
  const stats = [
    s.durationSeconds ? formatDuration(s.durationSeconds) : null,
    plural(s.totalWorkingSets ?? 0, "série", "séries"),
    s.totalVolumeKg ? formatVolume(s.totalVolumeKg) : null,
  ].filter((x) => x !== null);
  return (
    <Link href={`/app/workout/${s.id}/summary`} data-session-row={s.id}>
      <Card className="is-link">
        <CardContent className="flex items-start justify-between gap-3 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="text-xs text-muted">
              {s.finishedAt
                ? dateStyle === "weekday"
                  ? formatAppDate(s.finishedAt, { weekday: "short", day: "2-digit", month: "short" })
                  : formatAppDate(s.finishedAt, { day: "2-digit", month: "short", year: "numeric" })
                : null}
            </p>
            <p className="mt-1 font-mono text-[11px] tabular-nums text-muted">
              {stats.map((t, i) => (
                <Fragment key={i}>
                  {i > 0 ? " " : null}
                  <span className="whitespace-nowrap">
                    {t}
                    {i < stats.length - 1 ? " ·" : ""}
                  </span>
                </Fragment>
              ))}
            </p>
          </div>
          {s.recordCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold tabular-nums">
              <Lettermark code="PR" className="size-5 text-[9px]" />
              <span className="sr-only">{plural(s.recordCount, "recorde", "recordes")}</span>
              {s.recordCount > 1 ? <span aria-hidden>×{s.recordCount}</span> : null}
            </span>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
