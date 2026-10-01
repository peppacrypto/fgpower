import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/require-user";
import { hadSessionCookie } from "@/lib/auth/session-cookie";
import { loginAgainHref } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { getSharedWorkout } from "@/lib/data/share";
import { activityAccess } from "@/lib/social/authorization";
import { activityHref, profileHref, sharePath } from "@/lib/social/links";
import { formatShareDate, statsLine } from "@/lib/social/public-workout";
import { plural } from "@/lib/utils/format";
import { Avatar } from "@/components/ui/misc";
import { BackLink } from "@/components/nav/back-link";
import { ReportButton } from "@/components/social/report-sheet";
import { PublicWorkoutCard } from "@/components/share/public-workout-card";
import { JoinCta } from "@/components/share/join-cta";
import { OwnerLinkBanner } from "@/components/share/owner-link-banner";
import { FollowAuthor } from "./follow-author";

type Props = { params: Promise<{ token: string }> };

/**
 * A shared workout (W-008): /t/<token> opens this one workout to whoever
 * holds the link — signed out included — whatever its visibility, and
 * nothing else of its author's. A signed-in viewer who may see it in the app
 * anyway goes to the full page there; the owner sees the public view with a
 * way to turn the link off. Never indexed.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedWorkout(token);
  const robots = { index: false, follow: false };
  if (!shared) return { title: "Link desativado", robots };
  const title = `${shared.view.workoutName} — treino de ${shared.author.name}`;
  const records = shared.view.records.length;
  const description = `${statsLine(shared.view, shared.durationSeconds)} · ${
    records > 0 ? `${plural(records, "recorde", "recordes")} · ` : ""
  }Veja o treino na FGPOWER.`;
  return {
    title,
    description,
    robots,
    openGraph: { type: "article", siteName: "FGPOWER", locale: "pt_BR", title, description, url: sharePath(token) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedWorkoutPage({ params }: Props) {
  const { token } = await params;
  const shared = await getSharedWorkout(token);
  if (!shared) notFound();
  const { activity, author } = shared;

  const auth = await getCurrentSession();
  const viewerId = auth?.user.id ?? null;
  const isOwner = viewerId === activity.userId;
  let relation: "NONE" | "REQUESTED" | "FOLLOWING" = "NONE";
  if (viewerId && !isOwner) {
    const access = await activityAccess(viewerId, activity, token);
    if (access === "none") notFound();
    // They may see it in the app: the full page there (FG, report).
    if (access === "in-app") redirect(activityHref(activity.id));
    const [follows, request] = await Promise.all([
      prisma.follow.count({ where: { followerId: viewerId, followingId: author.id } }),
      prisma.followRequest.count({ where: { requesterId: viewerId, targetId: author.id, status: "PENDING" } }),
    ]);
    relation = follows > 0 ? "FOLLOWING" : request > 0 ? "REQUESTED" : "NONE";
  }
  const here = sharePath(token);
  const sessionEnded = !viewerId && (await hadSessionCookie());

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6">
      {viewerId ? <BackLink fallbackHref="/app/feed" className="-mt-2 mb-2" /> : null}
      {isOwner ? <OwnerLinkBanner sessionId={activity.sessionId} /> : null}

      <div className={isOwner ? "mt-5 flex items-center gap-3" : "flex items-center gap-3"}>
        <Avatar src={author.image} name={author.name} size={44} />
        <div className="min-w-0 flex-1">
          {author.username ? (
            <Link href={profileHref(author.username)} className="block truncate font-semibold hover:underline">
              {author.name}
            </Link>
          ) : (
            <p className="truncate font-semibold">{author.name}</p>
          )}
          <p className="truncate font-mono text-[11px] text-muted">
            {author.username ? `@${author.username} · ` : ""}
            {formatShareDate(shared.finishedAt)}
          </p>
        </div>
      </div>
      {activity.caption ? <p className="mt-3 text-sm text-foreground/90 wrap-break-word whitespace-pre-line">{activity.caption}</p> : null}

      <PublicWorkoutCard
        view={shared.view}
        finishedAt={shared.finishedAt}
        durationSeconds={shared.durationSeconds}
        ordinal={shared.ordinal}
        fgCount={activity.fgCount}
        className="mt-4"
      />

      {viewerId && !isOwner ? (
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          {/* Offered while they neither follow nor asked; kept on screen after a tap (follow-author.tsx). */}
          <FollowAuthor
            targetUserId={author.id}
            username={author.username}
            name={author.name}
            initialRelation={relation}
            isPrivate={!shared.authorIsPublic}
          />
          <ReportButton
            target={{ kind: "activity", activityId: activity.id, author: { id: author.id, username: author.username, name: author.name } }}
            shareToken={token}
          />
        </div>
      ) : null}

      {!viewerId ? (
        <JoinCta
          name={author.name}
          handle={author.username}
          returnTo={here}
          sessionEnded={sessionEnded}
          loginAgainHref={loginAgainHref(here)}
        />
      ) : null}
    </div>
  );
}
