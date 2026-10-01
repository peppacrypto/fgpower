import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { Lettermark } from "@/components/ui/glyph";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { canViewActivity } from "@/lib/social/authorization";
import { getFgGivers, hasEverGivenFg } from "@/lib/data/social";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivityExerciseSummary, WorkoutActivitySummary } from "@/lib/social/activity-summary";
import { describeRecord, groupRecordsByExercise } from "@/lib/training/personal-records-core";
import { formatSet, isTimedHold } from "@/lib/training/set-plan";
import { formatAppDate } from "@/lib/training/week";
import { formatDuration, formatVolume, plural } from "@/lib/utils/format";
import { profileHref } from "@/lib/social/links";
import { BackLink } from "@/components/nav/back-link";
import { ReportButton } from "@/components/social/report-sheet";
import { GiveFgButton } from "./give-fg-button";
import { OwnerControls } from "./owner-controls";
import { FgGivers } from "./fg-givers";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";
import { milestoneStampOf, type MilestoneStamp } from "@/components/social/milestone-stamp";
import { MilestoneStampDetail } from "@/components/social/milestone-stamp-card";

/** An exercise row of a stored summary; newer ones carry the slug and whether its reps are seconds. */
type ExerciseRow = ActivityExerciseSummary & { slug?: string | null; timed?: boolean };

/**
 * The activity and whether this viewer may see it — one lookup per request,
 * shared by generateMetadata and the page (React cache()).
 */
const loadActivity = cache(async (id: string) => {
  const [session, activity] = await Promise.all([
    getCurrentSession(),
    prisma.activity.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, username: true, image: true, profile: { select: { displayName: true } } },
        },
      },
    }),
  ]);
  const viewerId = session?.user.id ?? null;
  if (!activity) return { viewerId, activity: null, hasGivenFg: false };
  const [allowed, fg] = await Promise.all([
    canViewActivity(viewerId, activity),
    viewerId
      ? prisma.activityFG.findUnique({ where: { activityId_userId: { activityId: id, userId: viewerId } } })
      : null,
  ]);
  return { viewerId, activity: allowed ? activity : null, hasGivenFg: Boolean(fg) };
});

export async function generateMetadata({ params }: PageProps<"/app/activity/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { activity } = await loadActivity(id);
  return { title: activity ? "Atividade" : NOT_FOUND_TITLE };
}

export default async function ActivityDetailPage({ params }: PageProps<"/app/activity/[id]">) {
  const { id } = await params;
  const { viewerId, activity, hasGivenFg } = await loadActivity(id);
  if (!activity) notFound();
  const isOwner = viewerId === activity.userId;

  // The name the user chose for the app, not the one from their Google account.
  const name = activity.user.profile?.displayName?.trim() || activity.user.name;
  const header = (
    <div className="mt-2 flex items-center gap-3">
      <Avatar src={activity.user.image} name={name} size={44} />
      <div className="min-w-0">
        <p className="font-semibold [overflow-wrap:anywhere]">
          {activity.user.username ? (
            <Link href={profileHref(activity.user.username)} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </p>
        <p className="text-xs text-muted">{formatAppDate(activity.createdAt, { dateStyle: "long" })}</p>
      </div>
    </div>
  );

  // A private milestone (10th workout, a completed block): its stamp — no FG, no report.
  const stamp = activity.type === "MILESTONE" || activity.type === "PROGRAM_COMPLETED" ? milestoneStampOf(activity.summary) : null;
  if (stamp) {
    const links = await stampLinks(stamp, activity.userId, isOwner);
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <BackLink fallbackHref={isOwner ? "/app/profile" : "/app/feed"} />
        {header}
        <MilestoneStampDetail stamp={stamp} createdAt={activity.createdAt} {...links} />
      </div>
    );
  }

  const summary = activity.summary as unknown as WorkoutActivitySummary;
  // Grouped per exercise (stored in workout order); session-volume entries of older summaries dropped.
  const prGroups = groupRecordsByExercise(summary.prs ?? [], (pr) => pr.exerciseName);
  // Older summaries kept skipped exercises as "0 séries": only what was trained.
  const exercises = ((summary.exercises ?? []) as ExerciseRow[]).filter((ex) => ex.workingSets > 0);
  const isWorkout = activity.type === "WORKOUT";

  const [givers, gaveFg, link] = await Promise.all([
    activity.fgCount > 0 ? getFgGivers(activity.id, viewerId) : [],
    viewerId && !isOwner ? hasEverGivenFg(viewerId) : true,
    // The owner's share link, read explicitly (Activity.shareToken is omitted by default).
    isOwner && isWorkout
      ? prisma.activity.findUnique({ where: { id: activity.id }, select: { shareToken: true } })
      : null,
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <BackLink fallbackHref="/app/feed" />
      {header}

      {activity.caption ? <p className="mt-4 text-foreground/90 [overflow-wrap:anywhere]">{activity.caption}</p> : null}

      <Card className="mt-4">
        <CardContent className="pt-5">
          <h1 className="text-xl font-bold [overflow-wrap:anywhere]">{summary.workoutName}</h1>
          <p className="mt-1 text-sm text-muted">
            {summary.durationSeconds ? `${formatDuration(summary.durationSeconds)} · ` : ""}
            {plural(summary.totalWorkingSets, "série de trabalho", "séries de trabalho")}
            {summary.totalVolumeKg && activity.showDetailedLoads ? ` · ${formatVolume(summary.totalVolumeKg)} de volume` : ""}
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

          {exercises.length > 0 ? (
            <div className="mt-4 flex flex-col gap-1.5">
              {exercises.map((ex, i) => (
                // A long line ("4 séries · 100 kg × 5" on a 320px phone) drops under the name
                // instead of squeezing it to a few letters a line.
                <div key={i} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 text-sm">
                  <span className="min-w-0 flex-1 basis-24 [overflow-wrap:anywhere]">{ex.name}</span>
                  <span className="ml-auto shrink-0 whitespace-nowrap font-mono tabular-nums text-muted">
                    {plural(ex.workingSets, "série", "séries")}
                    {ex.bestSet && activity.showDetailedLoads
                      ? ` · ${formatSet(ex.bestSet.weightKg, ex.bestSet.reps, { timed: ex.timed ?? isTimedHold({ slug: ex.slug }) })}`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        {viewerId ? (
          <GiveFgButton
            activityId={activity.id}
            initialCount={activity.fgCount}
            initialGiven={hasGivenFg}
            isOwn={isOwner}
            hint={!gaveFg}
            // The hint wraps inside this column: "Denunciar" keeps its place on the row.
            className="min-w-0 flex-1"
          />
        ) : (
          <Badge>{plural(activity.fgCount, "FG", "FGs")}</Badge>
        )}
        {viewerId && !isOwner ? (
          <ReportButton
            className="shrink-0"
            target={{
              kind: "activity",
              activityId: activity.id,
              author: { id: activity.user.id, username: activity.user.username, name },
            }}
          />
        ) : null}
      </div>
      <FgGivers givers={givers} total={activity.fgCount} />

      {isOwner && isWorkout ? (
        <OwnerControls
          activityId={activity.id}
          sessionId={activity.sessionId}
          initialVisibility={activity.visibility}
          moderated={activity.moderatedAt !== null}
          linkShared={Boolean(link?.shareToken)}
        />
      ) : null}
    </div>
  );
}

/**
 * Where a stamp leads its owner: the workout that reached the number, or the
 * block's program (its template when the program is gone). Nothing for anyone else.
 */
async function stampLinks(
  stamp: MilestoneStamp,
  ownerId: string,
  isOwner: boolean,
): Promise<{ sessionHref: string | null; programHref: string | null; lastWorkoutAt?: Date | null }> {
  if (!isOwner) return { sessionHref: null, programHref: null };
  if (stamp.kind === "WORKOUT_COUNT") {
    const session = stamp.sessionId
      ? await prisma.workoutSession.findFirst({
          where: { id: stamp.sessionId, userId: ownerId, status: "COMPLETED" },
          select: { id: true },
        })
      : null;
    return { sessionHref: session ? `/app/workout/${session.id}/summary` : null, programHref: null };
  }
  const [enrollment, lastWorkout] = stamp.enrollmentId
    ? await Promise.all([
        prisma.programEnrollment.findFirst({ where: { id: stamp.enrollmentId, userId: ownerId }, select: { programId: true } }),
        // The block ends with its last workout, not when the calendar closed it.
        prisma.workoutSession.findFirst({
          where: { userId: ownerId, enrollmentId: stamp.enrollmentId, status: "COMPLETED", finishedAt: { not: null } },
          orderBy: { finishedAt: "desc" },
          select: { finishedAt: true },
        }),
      ])
    : [null, null];
  return {
    lastWorkoutAt: lastWorkout?.finishedAt ?? null,
    sessionHref: null,
    programHref: enrollment
      ? `/app/programs/${enrollment.programId}`
      : stamp.templateSlug
        ? `/app/programs/templates/${stamp.templateSlug}`
        : null,
  };
}
