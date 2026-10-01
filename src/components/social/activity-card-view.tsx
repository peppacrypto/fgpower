"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Lettermark } from "@/components/ui/glyph";
import { formatAppDate } from "@/lib/training/week";
import { formatDuration, formatVolume, plural, pluralWord } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { activityHref, profileHref } from "@/lib/social/links";
import type { ActivityCardSummary } from "@/lib/social/activity-summary";
import { ActionErrorText } from "./session-expired";
import { FG_HINT, FG_TITLE, useFgToggle } from "./use-fg";

/** Record badges shown on a card; the rest collapse into "+N". */
const MAX_PR_BADGES = 3;

/** The chip on the viewer's own cards (W-144), drawn in mono caps. */
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
  const person = (
    <>
      <Avatar src={activity.user.image} name={activity.user.name} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{activity.user.name}</span>
        <span className="block text-xs text-muted">
          {formatAppDate(activity.createdAt, { day: "2-digit", month: "short" })}
        </span>
      </span>
    </>
  );

  return (
    <article className={cn("reg-frame relative p-4", stretched && "is-link")} aria-label={`${activity.user.name}: ${workout}`}>
      <div className="flex items-center gap-3">
        {activity.user.username ? (
          <Link
            href={profileHref(activity.user.username)}
            className="relative z-10 -my-1 flex min-h-11 min-w-0 flex-1 items-center gap-2.5 hover:[&_span.font-semibold]:underline"
          >
            {person}
          </Link>
        ) : (
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5">{person}</div>
        )}
        {chip ? (
          <Link
            href={`${detailsHref}#quem-ve`}
            aria-label={`Visibilidade: ${chip}. Alterar`}
            className="tag tag--spec hit z-10 shrink-0 uppercase tracking-[0.1em] hover:text-accent"
          >
            {chip}
          </Link>
        ) : null}
      </div>

      {activity.caption ? <p className="mt-3 text-sm text-foreground/90">{activity.caption}</p> : null}

      <div className="mt-3 border-l-2 border-l-accent bg-surface-2 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{workout}</p>
          {activity.summary.durationSeconds ? (
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{formatDuration(activity.summary.durationSeconds)}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          {plural(activity.summary.totalWorkingSets, "série de trabalho", "séries de trabalho")}
          {activity.summary.totalVolumeKg ? ` · ${formatVolume(activity.summary.totalVolumeKg)} de volume` : ""}
        </p>
        {prNames.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {prNames.slice(0, MAX_PR_BADGES).map((name) => (
              <Badge key={name} variant="accent" className="max-w-full gap-1">
                <Lettermark code="PR" plain className="text-[9px]" />
                <span className="truncate">{name}</span>
              </Badge>
            ))}
            {morePrs > 0 ? (
              <Badge>
                +{morePrs}
                <span className="sr-only">{pluralWord(morePrs, " exercício com recorde", " exercícios com recorde")}</span>
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {signInReturnTo ? (
          <Link
            href={`/login?next=${encodeURIComponent(signInReturnTo)}`}
            className="relative z-10 flex min-h-11 items-center gap-1.5 rounded-[2px] border border-border px-3 text-sm font-semibold text-muted hover:bg-surface-2"
          >
            <Heart className="size-4" />
            Entre para dar FG
            {fg.count > 0 ? <span className="font-mono tabular-nums">· {fg.count}</span> : null}
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
              "relative z-10 flex min-h-11 items-center gap-1.5 rounded-[2px] border px-3 text-sm font-semibold transition-colors",
              fg.given ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2",
              isOwn && "opacity-50",
            )}
          >
            <Heart className="size-4" fill={fg.given ? "currentColor" : "none"} />
            FG {fg.count > 0 ? <span className="font-mono tabular-nums">{fg.count}</span> : ""}
          </button>
        )}
        <Link
          href={detailsHref}
          className={cn(
            "inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground",
            // Stretched: its hit area is the whole card.
            stretched && "after:absolute after:inset-0 after:content-['']",
          )}
        >
          Ver detalhes<span className="sr-only">: {workout}</span>
        </Link>
        {fgHint && !isOwn && !signInReturnTo && !fg.given ? (
          <p className="basis-full text-xs text-muted">{FG_HINT}</p>
        ) : null}
        {fg.error ? (
          <p role="alert" className="relative z-10 basis-full text-xs text-danger">
            <ActionErrorText error={fg.error} />
          </p>
        ) : null}
      </div>
    </article>
  );
}
