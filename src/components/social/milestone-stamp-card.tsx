import Link from "next/link";
import { GArrow } from "@/components/ui/glyph";
import { formatAppDate } from "@/lib/training/week";
import { plural, pluralWord } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { blockStampLine, stampText, type MilestoneStamp } from "./milestone-stamp";

const FIELD = "font-mono text-[10px] font-bold uppercase tracking-[0.16em]";
const LINK =
  "inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline";

/** The stamp itself, as the workout summary prints "DOSSIÊ Nº 50": slightly askew, in ink. */
function Stamp({ stamp, large = false, className }: { stamp: MilestoneStamp; large?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full -rotate-2 border-2 border-accent font-mono font-extrabold uppercase text-accent",
        large ? "px-3 py-1.5 text-base tracking-[0.18em]" : "px-2.5 py-1 text-sm tracking-[0.16em]",
        className,
      )}
    >
      {stampText(stamp)}
    </span>
  );
}

/** "10 treinos registrados até aqui." / "4 semanas · 18 de 20 treinos". */
function stampLine(stamp: MilestoneStamp): string {
  return stamp.kind === "WORKOUT_COUNT"
    ? `${plural(stamp.count, "treino registrado", "treinos registrados")} até aqui.`
    : (blockStampLine(stamp) ?? "Bloco concluído.");
}

/**
 * A milestone in the owner's feed or profile: a compact stamp card — no FG,
 * nothing to report (it is private: only its owner ever sees it). The 10th
 * workout opens that workout; a block opens its page (/app/activity).
 */
export function MilestoneStampCard({
  activityId,
  createdAt,
  stamp,
  isOwn,
}: {
  activityId: string;
  createdAt: Date | string;
  stamp: MilestoneStamp;
  isOwn: boolean;
}) {
  const workout = stamp.kind === "WORKOUT_COUNT" && isOwn && stamp.sessionId ? `/app/workout/${stamp.sessionId}/summary` : null;
  return (
    <div className="reg-frame p-4" data-stamp={stamp.kind}>
      <div className="flex items-start justify-between gap-3">
        <Stamp stamp={stamp} className="mt-0.5" />
        <span className="shrink-0 text-xs text-muted">{formatAppDate(createdAt, { day: "2-digit", month: "short" })}</span>
      </div>
      <p className="mt-3 text-sm">{stampLine(stamp)}</p>
      {stamp.kind === "WORKOUT_COUNT" && stamp.workoutName ? (
        <p className="mt-0.5 text-xs text-muted">
          {stamp.count}º treino: {stamp.workoutName}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
        <span className={cn(FIELD, "text-muted")}>Só você vê</span>
        {workout ? (
          <Link href={workout} className={LINK}>
            Ver o treino
            <GArrow className="size-3" />
          </Link>
        ) : (
          <Link href={`/app/activity/${activityId}`} className={LINK}>
            {stamp.kind === "BLOCK_COMPLETED" ? "Ver o bloco" : "Ver detalhes"}
            <GArrow className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * A milestone's own page (/app/activity/[id]): the stamp, what it marks —
 * the workout that reached the number, or the block's weeks and workouts —
 * and where to go from it. Private, like the card: no FG, no report.
 */
export function MilestoneStampDetail({
  stamp,
  createdAt,
  programHref,
  sessionHref,
  lastWorkoutAt = null,
}: {
  stamp: MilestoneStamp;
  createdAt: Date | string;
  /** The block's last workout: the block ends there, not when it was closed (the next visit, maybe days later). */
  lastWorkoutAt?: Date | null;
  /** The block's program (or its template), for its owner. */
  programHref: string | null;
  /** The workout that reached the number, for its owner. */
  sessionHref: string | null;
}) {
  const date = formatAppDate(createdAt, { day: "2-digit", month: "long" });
  return (
    <section className="relative mt-4 overflow-hidden panel-raised" data-stamp={stamp.kind} aria-labelledby="stamp-title">
      <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
      <div className="p-5 pl-6 sm:p-7 sm:pl-8">
        <p className={cn(FIELD, "text-muted")}>Carimbo · só você vê</p>
        <Stamp stamp={stamp} large className="mt-3" />
        {stamp.kind === "WORKOUT_COUNT" ? (
          <>
            <h1 id="stamp-title" className="mt-4 text-xl font-bold">
              {plural(stamp.count, "treino registrado", "treinos registrados")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {stamp.workoutName ? `O ${stamp.count}º foi ${stamp.workoutName}, em ${date}.` : `O ${stamp.count}º foi em ${date}.`}
            </p>
            {sessionHref ? (
              <Link href={sessionHref} className={cn(LINK, "mt-2")}>
                Ver o treino
                <GArrow className="size-3" />
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <h1 id="stamp-title" className="text-display mt-4 text-2xl font-extrabold leading-tight">
              {stamp.programName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {lastWorkoutAt
                ? `Último treino do bloco em ${formatAppDate(lastWorkoutAt, { day: "2-digit", month: "long" })}.`
                : `Encerrado em ${date}.`}
            </p>
            {stamp.weeks != null || stamp.sessionsDone != null ? (
              <dl className="mt-4 grid grid-cols-2 divide-x divide-border border-y border-border py-3 text-center">
                {stamp.sessionsDone != null ? (
                  <div className="flex flex-col px-2">
                    <dt className={cn(FIELD, "text-muted")}>
                      {pluralWord(stamp.plannedSessions ?? stamp.sessionsDone, "treino", "treinos")}
                    </dt>
                    <dd className="order-first font-mono text-xl font-bold tabular-nums">
                      {stamp.plannedSessions ? `${stamp.sessionsDone}/${stamp.plannedSessions}` : stamp.sessionsDone}
                    </dd>
                  </div>
                ) : null}
                {stamp.weeks != null ? (
                  <div className="flex flex-col px-2">
                    <dt className={cn(FIELD, "text-muted")}>{stamp.weeks === 1 ? "semana" : "semanas"}</dt>
                    <dd className="order-first font-mono text-xl font-bold tabular-nums">{stamp.weeks}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {programHref ? (
              <Link href={programHref} className={cn(LINK, "mt-2")}>
                Ver o programa
                <GArrow className="size-3" />
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
