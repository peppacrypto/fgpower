"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Lettermark } from "@/components/ui/glyph";
import { giveFg, removeFg } from "@/lib/actions/social";
import { formatAppDate } from "@/lib/training/week";
import { formatDuration, formatVolume, plural, pluralWord } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ActivityCardSummary } from "@/lib/social/activity-summary";
import { runAction } from "./run-action";

/** Record badges shown on a card; the rest collapse into "+N". */
const MAX_PR_BADGES = 3;

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
}

/** The interactive card (FG). Rendered through ActivityCard, which trims the stored summary first. */
export function ActivityCardView({
  activity,
  currentUsername,
  isOwn: isOwnProp,
  signInReturnTo,
}: {
  activity: ActivityCardViewData;
  currentUsername?: string | null;
  /** Whether the viewer wrote this activity (preferred over the username match). */
  isOwn?: boolean;
  /** Set when the viewer is signed out: FG becomes a sign-in link that returns here. */
  signInReturnTo?: string;
}) {
  const [fgCount, setFgCount] = useState(activity.fgCount);
  const [given, setGiven] = useState(activity.hasGivenFg);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isOwn = isOwnProp ?? (currentUsername != null && activity.user.username === currentUsername);
  // One badge per exercise (a session can set several record kinds on one lift).
  const prNames = activity.summary.prNames;
  const morePrs = prNames.length - MAX_PR_BADGES;

  function toggleFg() {
    const before = { given, fgCount };
    const next = !given;
    // Optimistic; rolled back below if the server says no or the call fails.
    setGiven(next);
    setFgCount((c) => c + (next ? 1 : -1));
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => (next ? giveFg(activity.id) : removeFg(activity.id)));
      if (result.ok) {
        setFgCount(result.fgCount);
      } else {
        setGiven(before.given);
        setFgCount(before.fgCount);
        setError(result.error);
      }
    });
  }

  return (
    <div className="reg-frame p-4">
      <div className="flex items-center gap-2.5">
        <Avatar src={activity.user.image} name={activity.user.name} size={36} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold">
            {activity.user.username ? (
              <Link href={`/u/${activity.user.username}`} className="hover:underline">
                {activity.user.name}
              </Link>
            ) : (
              activity.user.name
            )}
          </p>
          <p className="text-xs text-muted">
            {formatAppDate(activity.createdAt, { day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>

      {activity.caption ? <p className="mt-3 text-sm text-foreground/90">{activity.caption}</p> : null}

      <div className="mt-3 rounded-[var(--radius-md)] bg-surface-2 p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{activity.summary.workoutName}</p>
          {activity.summary.durationSeconds ? (
            <span className="shrink-0 text-xs text-muted">{formatDuration(activity.summary.durationSeconds)}</span>
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

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {signInReturnTo ? (
          <Link
            href={`/login?next=${encodeURIComponent(signInReturnTo)}`}
            className="flex items-center gap-1.5 rounded-[2px] border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2"
          >
            <Heart className="size-4" />
            Entre para dar FG
            {fgCount > 0 ? <span className="font-mono tabular-nums">· {fgCount}</span> : null}
          </Link>
        ) : (
          <button
            type="button"
            disabled={pending || isOwn}
            aria-pressed={given}
            aria-label={given ? `Remover FG (${fgCount})` : `Dar FG (${fgCount})`}
            onClick={toggleFg}
            className={cn(
              "flex items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-sm font-semibold transition-colors",
              given ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2",
              isOwn && "opacity-50",
            )}
          >
            <Heart className="size-4" fill={given ? "currentColor" : "none"} />
            FG {fgCount > 0 ? fgCount : ""}
          </button>
        )}
        <Link href={`/app/activity/${activity.id}`} className="text-xs text-muted hover:text-foreground">
          Ver detalhes
        </Link>
        {error ? (
          <p role="alert" className="basis-full text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
