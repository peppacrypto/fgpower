"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { GArrow } from "@/components/ui/glyph";
import { formatAppDate } from "@/lib/training/week";
import { formatDuration, formatVolume, pluralWord } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { activityHref, profileHref } from "@/lib/social/links";
import type { ActivityCardSummary } from "@/lib/social/activity-summary";
import { ActionErrorText } from "./session-expired";
import { FG_HINT, FG_TITLE, useFgToggle } from "./use-fg";

/** Record badges shown on a card; the rest collapse into "+N". */
const MAX_PR_BADGES = 3;

/** The chip on the viewer's own cards (W-144). */
const VISIBILITY_LABEL = { PRIVATE: "Privado", FOLLOWERS: "Seguidores", PUBLIC: "Público" } as const;

/** The card's data once trimmed on the server (see ./activity-card.tsx). */
export interface ActivityCardViewData {
  id: string;
  sessionId: string | null;
  caption: string | null;
  createdAt: Date | string;
  fgCount: number;
  hasGivenFg: boolean;
  user: { name: string; username: string | null; image: string | null };
  summary: ActivityCardSummary;
  /** Only on the viewer's own cards: who sees it. */
  visibility?: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
}

/** The interactive card (FG). Rendered through ActivityCard, which trims the stored summary first. */
export function ActivityCardView({
  activity,
  currentUsername,
  isOwn: isOwnProp,
  signInReturnTo,
  fgHint = false,
}: {
  activity: ActivityCardViewData;
  currentUsername?: string | null;
  /** Whether the viewer wrote this activity (preferred over the username match). */
  isOwn?: boolean;
  /** Set when the viewer is signed out: FG becomes a sign-in link that returns here. */
  signInReturnTo?: string;
  /** Explain FG under the heart (the viewer never gave one). */
  fgHint?: boolean;
}) {
  const fg = useFgToggle({ activityId: activity.id, initialGiven: activity.hasGivenFg, initialCount: activity.fgCount });
  const isOwn = isOwnProp ?? (currentUsername != null && activity.user.username === currentUsername);
  // One badge per exercise (a session can set several record kinds on one lift).
  const prNames = activity.summary.prNames;
  const morePrs = prNames.length - MAX_PR_BADGES;

  const detailsHref = activityHref(activity.id);
  const workout = activity.summary.workoutName;
  // Signed in, the whole card opens the workout (a stretched "Ver detalhes"
  // link); the profile link, the chip and FG sit above it and keep their own taps.
  const stretched = !signInReturnTo;
  const chip = isOwn && stretched && activity.visibility ? VISIBILITY_LABEL[activity.visibility] : null;
  const date = formatAppDate(activity.createdAt, { day: "2-digit", month: "short" });
  const person = (
    <>
      <Avatar src={activity.user.image} name={activity.user.name} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight">{activity.user.name}</span>
        {/* The handle and the date wrap as wholes: beside the visibility chip on a phone,
            the date drops under the handle instead of being cut. */}
        <span className="mt-0.5 flex flex-wrap gap-x-1 text-[13px] text-muted">
          {activity.user.username ? <span className="min-w-0 truncate">@{activity.user.username} ·</span> : null}
          <span className="whitespace-nowrap">{date}</span>
        </span>
      </span>
    </>
  );

  return (
    <article className={cn("card relative p-4 sm:p-5", stretched && "is-link")} aria-label={`${activity.user.name}: ${workout}`}>
      <div className="flex items-center gap-3">
        {activity.user.username ? (
          <Link
            href={profileHref(activity.user.username)}
            className="relative z-10 -my-1 flex min-h-11 min-w-0 flex-1 items-center gap-3 hover:[&_span.font-semibold]:underline"
          >
            {person}
          </Link>
        ) : (
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3">{person}</div>
        )}
        {chip ? (
          <Link
            href={`${detailsHref}#quem-ve`}
            aria-label={`Visibilidade: ${chip}. Alterar`}
            className="tag tag--spec hit z-10 shrink-0 text-muted hover:text-accent"
          >
            {chip}
          </Link>
        ) : null}
      </div>

      <p className="mt-4 text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">{workout}</p>
      {activity.caption ? <p className="mt-1 text-[15px] leading-relaxed text-foreground/90">{activity.caption}</p> : null}

      {/* The few numbers that tell the workout: time, sets and (loads shown) volume. */}
      <WorkoutStats
        className="mt-3"
        durationSeconds={activity.summary.durationSeconds}
        workingSets={activity.summary.totalWorkingSets}
        volumeKg={activity.summary.totalVolumeKg}
      />
      {prNames.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Recordes">
          {prNames.slice(0, MAX_PR_BADGES).map((name) => (
            <li key={name} className="tag tag--mark max-w-full">
              <span aria-hidden>PR</span>
              <span className="truncate font-medium">{name}</span>
            </li>
          ))}
          {morePrs > 0 ? (
            <li className="tag tag--spec">
              +{morePrs}
              <span className="sr-only">{pluralWord(morePrs, " exercício com recorde", " exercícios com recorde")}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3">
        {signInReturnTo ? (
          <Link
            href={`/login?next=${encodeURIComponent(signInReturnTo)}`}
            className="relative z-10 flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3.5 text-sm font-semibold text-foreground hover:bg-surface-2"
          >
            <Heart className="size-4" />
            Entre para dar FG
            {fg.count > 0 ? <span className="tabular-nums text-muted">· {fg.count}</span> : null}
          </Link>
        ) : (
          <button
            type="button"
            disabled={fg.pending || isOwn}
            aria-pressed={fg.given}
            title={FG_TITLE}
            aria-label={
              isOwn
                ? `FGs no seu treino ${workout} (${fg.count})`
                : fg.given
                  ? `Remover FG do treino ${workout} de ${activity.user.name} (${fg.count})`
                  : `Dar FG no treino ${workout} de ${activity.user.name} (${fg.count})`
            }
            onClick={fg.toggle}
            className={cn(
              "relative z-10 flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border px-3.5 text-sm font-semibold transition-colors",
              fg.given
                ? "border-accent bg-accent-soft text-accent"
                : "border-border-strong bg-surface text-foreground hover:bg-surface-2",
              isOwn && "border-border bg-transparent text-muted disabled:opacity-100",
            )}
          >
            <Heart className="size-4" fill={fg.given ? "currentColor" : "none"} />
            FG {fg.count > 0 ? <span className="tabular-nums">{fg.count}</span> : ""}
          </button>
        )}
        <Link
          href={detailsHref}
          className={cn(
            "ml-auto inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-muted hover:text-foreground",
            // Stretched: its hit area is the whole card.
            stretched && "after:absolute after:inset-0 after:content-['']",
          )}
        >
          Ver detalhes<span className="sr-only">: {workout}</span>
          <GArrow className="size-3.5" />
        </Link>
        {fgHint && !isOwn && !signInReturnTo && !fg.given ? (
          <p className="basis-full text-[13px] text-muted">{FG_HINT}</p>
        ) : null}
        {fg.error ? (
          <p role="alert" className="relative z-10 basis-full text-[13px] text-danger">
            <ActionErrorText error={fg.error} />
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * A workout's key numbers in one line — "1 h 3 min · 17 séries de trabalho ·
 * 9.420 kg de volume" — the values set in the foreground, their words muted.
 * Shared by the feed card and the activity page.
 */
export function WorkoutStats({
  durationSeconds,
  workingSets,
  volumeKg,
  className,
}: {
  durationSeconds: number | null;
  workingSets: number;
  /** Null when the loads are hidden (or none were recorded). */
  volumeKg: number | null;
  className?: string;
}) {
  const value = "text-[15px] font-semibold text-foreground";
  const items = [
    durationSeconds ? <strong className={value}>{formatDuration(durationSeconds)}</strong> : null,
    <>
      <strong className={value}>{workingSets}</strong>{" "}
      {pluralWord(workingSets, "série de trabalho", "séries de trabalho")}
    </>,
    volumeKg ? (
      <>
        <strong className={value}>{formatVolume(volumeKg)}</strong> de volume
      </>
    ) : null,
  ].filter(Boolean);
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] tabular-nums text-muted", className)}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 ? <span className="sr-only">· </span> : null}
          {item}
        </span>
      ))}
    </p>
  );
}
