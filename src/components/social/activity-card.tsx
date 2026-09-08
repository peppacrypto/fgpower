"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { giveFg, removeFg } from "@/lib/actions/social";
import { cn } from "@/lib/utils/cn";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";

export interface ActivityCardData {
  id: string;
  sessionId: string | null;
  caption: string | null;
  createdAt: Date | string;
  fgCount: number;
  hasGivenFg: boolean;
  user: { name: string; username: string | null; image: string | null };
  summary: WorkoutActivitySummary;
}

export function ActivityCard({ activity, currentUsername }: { activity: ActivityCardData; currentUsername?: string | null }) {
  const [fgCount, setFgCount] = useState(activity.fgCount);
  const [given, setGiven] = useState(activity.hasGivenFg);
  const [pending, startTransition] = useTransition();
  const isOwn = activity.user.username === currentUsername;

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
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
            {new Date(activity.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>

      {activity.caption ? <p className="mt-3 text-sm text-foreground/90">{activity.caption}</p> : null}

      <div className="mt-3 rounded-[var(--radius-md)] bg-surface-2 p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{activity.summary.workoutName}</p>
          {activity.summary.durationSeconds ? (
            <span className="text-xs text-muted">{Math.round(activity.summary.durationSeconds / 60)} min</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          {activity.summary.totalWorkingSets} séries de trabalho
          {activity.summary.totalVolumeKg ? ` · ${Math.round(activity.summary.totalVolumeKg)}kg de volume` : ""}
        </p>
        {activity.summary.prs.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activity.summary.prs.map((pr, i) => (
              <Badge key={i} variant="accent" className="gap-1">
                <Trophy className="size-3" />
                {pr.exerciseName}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={pending || isOwn}
          onClick={() => {
            const next = !given;
            setGiven(next);
            setFgCount((c) => c + (next ? 1 : -1));
            startTransition(async () => {
              if (next) await giveFg(activity.id);
              else await removeFg(activity.id);
            });
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
            given ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2",
            isOwn && "opacity-50",
          )}
        >
          <Heart className="size-4" fill={given ? "currentColor" : "none"} />
          FG {fgCount > 0 ? fgCount : ""}
        </button>
        <Link href={`/app/activity/${activity.id}`} className="text-xs text-muted hover:text-foreground">
          Ver detalhes
        </Link>
      </div>
    </div>
  );
}
