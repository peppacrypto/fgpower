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
 * One finished workout in the history lists: its name, then its day and what
 * it was — duration, working sets, volume — with a PR mark when it broke
 * records. Opens the workout's summary.
 */
export function SessionRow({ session: s, dateStyle = "full" }: { session: HistorySession; dateStyle?: "full" | "weekday" }) {
  const stats = [
    s.durationSeconds ? formatDuration(s.durationSeconds) : null,
    plural(s.totalWorkingSets ?? 0, "série", "séries"),
    s.totalVolumeKg ? formatVolume(s.totalVolumeKg) : null,
  ].filter((x) => x !== null);
  const date = s.finishedAt
    ? dateStyle === "weekday"
      ? formatAppDate(s.finishedAt, { weekday: "short", day: "2-digit", month: "short" })
      : formatAppDate(s.finishedAt, { day: "2-digit", month: "short", year: "numeric" })
    : null;
  return (
    <Link href={`/app/workout/${s.id}/summary`} data-session-row={s.id} className="block">
      <Card className="is-link">
        <CardContent className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-snug wrap-break-word">{s.name}</p>
            {/* The day, then the numbers; each part wraps whole. */}
            <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-[13px] tabular-nums text-muted">
              {[date, ...stats].filter((t) => t !== null).map((t, i, all) => (
                <span key={i} className={i === 0 && date ? "whitespace-nowrap text-foreground/80" : "whitespace-nowrap"}>
                  {t}
                  {i < all.length - 1 ? " ·" : ""}
                </span>
              ))}
            </p>
          </div>
          {s.recordCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold tabular-nums text-accent">
              <Lettermark code="PR" className="size-6 text-xs" />
              <span className="sr-only">{plural(s.recordCount, "recorde", "recordes")}</span>
              {s.recordCount > 1 ? <span aria-hidden>×{s.recordCount}</span> : null}
            </span>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
