import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/require-user";
import { getPublicProfile, getUserPublicActivities } from "@/lib/data/social";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ActivityCard } from "@/components/social/activity-card";
import { Wordmark } from "@/components/brand/logo";
import { FollowButton } from "./follow-button";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";
import Link from "next/link";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const session = await getCurrentSession();
  const viewerId = session?.user.id ?? null;

  const profile = await getPublicProfile(username, viewerId);
  if (!profile) notFound();

  const activities = await getUserPublicActivities(profile.id, viewerId, profile.canViewActivity);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <Link href={viewerId ? "/app/today" : "/"}>
          <Wordmark iconSize={26} />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-4">
          <Avatar src={profile.image} name={profile.name} size={72} />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{profile.name}</h1>
            <p className="text-sm text-muted">@{profile.username}</p>
          </div>
        </div>

        {profile.bio ? <p className="mt-3 text-sm text-foreground/90">{profile.bio}</p> : null}

        <div className="mt-3 flex gap-4 text-sm text-muted">
          <span>
            <strong className="text-foreground">{profile.followerCount}</strong> seguidores
          </span>
          <span>
            <strong className="text-foreground">{profile.followingCount}</strong> seguindo
          </span>
        </div>

        {profile.activeProgramName ? (
          <Badge variant="accent" className="mt-3 w-fit">
            Treinando: {profile.activeProgramName}
          </Badge>
        ) : null}

        {viewerId && viewerId !== profile.id ? (
          <div className="mt-4">
            <FollowButton
              targetUserId={profile.id}
              initialFollowing={profile.isFollowing}
              initialPending={profile.hasPendingRequest}
              isPrivate={!profile.isPublicAccount}
            />
          </div>
        ) : null}

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Atividade</h2>
          {!profile.canViewActivity ? (
            <p className="text-sm text-muted">Esta conta é privada. Siga para ver a atividade.</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma atividade pública ainda.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {activities.map((a) => (
                <ActivityCard
                  key={a.id}
                  currentUsername={session?.user.username}
                  activity={{
                    id: a.id,
                    sessionId: a.sessionId,
                    caption: a.caption,
                    createdAt: a.createdAt,
                    fgCount: a.fgCount,
                    hasGivenFg: false,
                    user: { name: profile.name, username: profile.username, image: profile.image },
                    summary: a.summary as unknown as WorkoutActivitySummary,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
