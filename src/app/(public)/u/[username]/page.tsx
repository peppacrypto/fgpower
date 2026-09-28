import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/require-user";
import { hadSessionCookie } from "@/lib/auth/session-cookie";
import { loginAgainHref, SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { getPublicProfile, getUserPublicActivities } from "@/lib/data/social";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/social/activity-card";
import { Wordmark } from "@/components/brand/logo";
import { FollowButton } from "@/components/social/follow-button";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";
import Link from "next/link";
import { formatNumber, pluralWord } from "@/lib/utils/format";

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
  // Signed-out visitors (usually from a shared link) sign in and land back here.
  const returnTo = `/u/${profile.username ?? username}`;
  const signInHref = `/login?next=${encodeURIComponent(returnTo)}`;
  // Signed out, but the browser still sent a session cookie: the session ended
  // (another device signed out, or it expired on the server) — typically
  // found by a tap on Seguir, whose re-render lands here. Say so.
  const sessionEnded = !viewerId && (await hadSessionCookie());

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
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{profile.name}</h1>
            <p className="truncate text-sm text-muted">@{profile.username}</p>
          </div>
        </div>

        {profile.bio ? <p className="mt-3 text-sm text-foreground/90">{profile.bio}</p> : null}

        <div className="mt-3 flex gap-4 text-sm text-muted">
          <span>
            <strong className="text-foreground">{formatNumber(profile.followerCount, 0)}</strong>{" "}
            {pluralWord(profile.followerCount, "seguidor", "seguidores")}
          </span>
          <span>
            <strong className="text-foreground">{formatNumber(profile.followingCount, 0)}</strong> seguindo
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
              username={profile.username}
              name={profile.name}
              initialRelation={profile.isFollowing ? "FOLLOWING" : profile.hasPendingRequest ? "REQUESTED" : "NONE"}
              isPrivate={!profile.isPublicAccount}
            />
          </div>
        ) : null}
        {!viewerId ? (
          <div className="mt-4 flex flex-col items-start gap-2">
            {sessionEnded ? (
              <p role="alert" className="border-l-2 border-l-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                {SESSION_EXPIRED_ERROR}
              </p>
            ) : null}
            <Button asChild>
              <Link href={sessionEnded ? loginAgainHref(returnTo) : signInHref}>
                {sessionEnded ? "Entrar de novo" : "Entre para seguir"}
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Atividade</h2>
          {!profile.canViewActivity ? (
            <p className="text-sm text-muted">Esta conta é privada. Siga para ver a atividade.</p>
          ) : activities.length === 0 ? (
            viewerId === profile.id ? (
              // The owner sees why their own profile is empty: workouts stay private until shared.
              <div className="border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
                <p className="font-medium">Seus treinos são privados.</p>
                <p className="mt-0.5 text-muted">
                  Para um treino aparecer aqui, compartilhe-o no resumo dele — para seguidores ou para todos.
                </p>
                <Link
                  href="/app/history"
                  className="mt-1 inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
                >
                  Abrir histórico
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhuma atividade pública ainda.</p>
            )
          ) : (
            <div className="flex flex-col gap-4">
              {activities.map((a) => (
                <ActivityCard
                  key={a.id}
                  currentUsername={session?.user.username}
                  isOwn={viewerId === profile.id}
                  signInReturnTo={viewerId ? undefined : returnTo}
                  activity={{
                    id: a.id,
                    sessionId: a.sessionId,
                    caption: a.caption,
                    createdAt: a.createdAt,
                    fgCount: a.fgCount,
                    hasGivenFg: a.hasGivenFg,
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
