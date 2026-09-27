import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lettermark } from "@/components/ui/glyph";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { canViewActivity } from "@/lib/social/authorization";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";
import { describeRecord, groupRecordsByExercise } from "@/lib/training/personal-records-core";
import { formatAppDate } from "@/lib/training/week";
import { formatDuration, formatKg, formatVolume, plural } from "@/lib/utils/format";
import { GiveFgButton } from "./give-fg-button";
import { ReportButton } from "./report-button";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

export async function generateMetadata({ params }: PageProps<"/app/activity/[id]">): Promise<Metadata> {
  const { id } = await params;
  const session = await getCurrentSession();
  const activity = await prisma.activity.findUnique({ where: { id } });
  const visible = activity ? await canViewActivity(session?.user.id ?? null, activity) : false;
  return { title: visible ? "Atividade" : NOT_FOUND_TITLE };
}

export default async function ActivityDetailPage({ params }: PageProps<"/app/activity/[id]">) {
  const { id } = await params;
  const session = await getCurrentSession();
  const viewerId = session?.user.id ?? null;

  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, username: true, image: true, profile: { select: { displayName: true } } },
      },
    },
  });
  if (!activity) notFound();

  const allowed = await canViewActivity(viewerId, activity);
  if (!allowed) notFound();

  const summary = activity.summary as unknown as WorkoutActivitySummary;
  // The name the user chose for the app, not the one from their Google account.
  const name = activity.user.profile?.displayName?.trim() || activity.user.name;
  // Grouped per exercise (stored in workout order); session-volume entries of older summaries dropped.
  const prGroups = groupRecordsByExercise(summary.prs ?? [], (pr) => pr.exerciseName);
  const hasGivenFg = viewerId
    ? Boolean(await prisma.activityFG.findUnique({ where: { activityId_userId: { activityId: id, userId: viewerId } } }))
    : false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <Avatar src={activity.user.image} name={name} size={44} />
        <div>
          <p className="font-semibold">
            {activity.user.username ? (
              <Link href={`/u/${activity.user.username}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </p>
          <p className="text-xs text-muted">{formatAppDate(activity.createdAt, { dateStyle: "long" })}</p>
        </div>
      </div>

      {activity.caption ? <p className="mt-4 text-foreground/90">{activity.caption}</p> : null}

      <Card className="mt-4">
        <CardContent className="pt-5">
          <h1 className="text-xl font-bold">{summary.workoutName}</h1>
          <p className="mt-1 text-sm text-muted">
            {summary.durationSeconds ? `${formatDuration(summary.durationSeconds)} · ` : ""}
            {plural(summary.totalWorkingSets, "série de trabalho", "séries de trabalho")}
            {summary.totalVolumeKg ? ` · ${formatVolume(summary.totalVolumeKg)} de volume` : ""}
          </p>

          {prGroups.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {prGroups.map((g) => (
                <div key={g.key} className="flex items-start gap-2 bg-accent-soft px-3 py-2 text-sm">
                  <Lettermark code="PR" className="mt-0.5 size-5 shrink-0 text-[9px]" />
                  <div className="min-w-0">
                    <p className="font-semibold text-accent">{g.key}</p>
                    <p className="text-xs text-foreground/80">
                      {g.records.map((r) => describeRecord(r, !activity.showDetailedLoads)).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {summary.exercises.length > 0 ? (
            <div className="mt-4 flex flex-col gap-1.5">
              {summary.exercises.map((ex, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">{ex.name}</span>
                  <span className="shrink-0 whitespace-nowrap font-mono tabular-nums text-muted">
                    {plural(ex.workingSets, "série", "séries")}
                    {ex.bestSet ? ` · ${formatKg(ex.bestSet.weightKg)} × ${ex.bestSet.reps}` : ""}
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
          <Badge>{plural(activity.fgCount, "FG", "FGs")}</Badge>
        )}
        {viewerId && viewerId !== activity.userId ? <ReportButton activityId={activity.id} /> : null}
      </div>
    </div>
  );
}
