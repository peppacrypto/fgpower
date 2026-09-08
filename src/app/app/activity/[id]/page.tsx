import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { canViewActivity } from "@/lib/social/authorization";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";
import { GiveFgButton } from "./give-fg-button";
import { ReportButton } from "./report-button";

export const metadata: Metadata = { title: "Atividade" };

export default async function ActivityDetailPage({ params }: PageProps<"/app/activity/[id]">) {
  const { id } = await params;
  const session = await getCurrentSession();
  const viewerId = session?.user.id ?? null;

  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, username: true, image: true } } },
  });
  if (!activity) notFound();

  const allowed = await canViewActivity(viewerId, activity);
  if (!allowed) notFound();

  const summary = activity.summary as unknown as WorkoutActivitySummary;
  const hasGivenFg = viewerId
    ? Boolean(await prisma.activityFG.findUnique({ where: { activityId_userId: { activityId: id, userId: viewerId } } }))
    : false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <Avatar src={activity.user.image} name={activity.user.name} size={44} />
        <div>
          <p className="font-semibold">
            {activity.user.username ? (
              <Link href={`/u/${activity.user.username}`} className="hover:underline">
                {activity.user.name}
              </Link>
            ) : (
              activity.user.name
            )}
          </p>
          <p className="text-xs text-muted">{new Date(activity.createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}</p>
        </div>
      </div>

      {activity.caption ? <p className="mt-4 text-foreground/90">{activity.caption}</p> : null}

      <Card className="mt-4">
        <CardContent className="pt-5">
          <h1 className="text-xl font-bold">{summary.workoutName}</h1>
          <p className="mt-1 text-sm text-muted">
            {summary.durationSeconds ? `${Math.round(summary.durationSeconds / 60)} min · ` : ""}
            {summary.totalWorkingSets} séries de trabalho
            {summary.totalVolumeKg ? ` · ${Math.round(summary.totalVolumeKg)}kg de volume` : ""}
          </p>

          {summary.prs.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {summary.prs.map((pr, i) => (
                <div key={i} className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-accent-soft px-3 py-2 text-sm text-accent">
                  <Trophy className="size-4" />
                  {pr.exerciseName}
                </div>
              ))}
            </div>
          ) : null}

          {summary.exercises.length > 0 ? (
            <div className="mt-4 flex flex-col gap-1.5">
              {summary.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{ex.name}</span>
                  <span className="text-muted">
                    {ex.workingSets} séries{ex.bestSet ? ` · ${ex.bestSet.weightKg}kg × ${ex.bestSet.reps}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center gap-3">
        {viewerId ? (
          <GiveFgButton activityId={activity.id} initialCount={activity.fgCount} initialGiven={hasGivenFg} isOwn={viewerId === activity.userId} />
        ) : (
          <Badge>{activity.fgCount} FGs</Badge>
        )}
        {viewerId && viewerId !== activity.userId ? <ReportButton activityId={activity.id} /> : null}
      </div>
    </div>
  );
}
