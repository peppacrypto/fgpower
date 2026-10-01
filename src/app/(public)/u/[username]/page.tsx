import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/require-user";
import { hadSessionCookie } from "@/lib/auth/session-cookie";
import { loginAgainHref, SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import {
  getProfileActivities,
  getPublicProfile,
  hasEverGivenFg,
  PROFILE_MAX_PAGES,
  PROFILE_PAGE_SIZE,
  type PublicProfile,
} from "@/lib/data/social";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { ActivityCard } from "@/components/social/activity-card";
import { milestoneStampOf } from "@/components/social/milestone-stamp";
import { FollowButton, FollowCountScope, LiveFollowerCount, type FollowRelation } from "@/components/social/follow-button";
import { ProfileMenu } from "@/components/social/profile-menu";
import { BackLink } from "@/components/nav/back-link";
import { ShareProfileButton } from "@/components/share/share-profile-button";
import { JoinCta } from "@/components/share/join-cta";
import { FocusLanding } from "@/app/app/feed/focus-landing";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";
import { profileHref } from "@/lib/social/links";
import { formatNumber, plural, pluralWord } from "@/lib/utils/format";

const LINK =
  "inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline";

/** A card's wrapper, where "Carregar mais" lands: a scroll margin, and a ring only for keyboard focus. */
const LANDING_CARD = "scroll-mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The owner's counts open their lists (/app/profile/seguidores, /seguindo). */
const COUNT_LINK =
  "inline-flex min-h-11 items-center underline decoration-[color-mix(in_oklab,var(--muted)_45%,transparent)] underline-offset-[3px] hover:text-foreground hover:decoration-current";

/** The viewer and the profile as they may see it — one lookup per request (metadata + page). */
const loadProfile = cache(async (username: string) => {
  const session = await getCurrentSession();
  const viewerId = session?.user.id ?? null;
  const profile = await getPublicProfile(username, viewerId);
  return { viewerId, profile };
});

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const { profile } = await loadProfile(username);
  if (!profile) return { title: NOT_FOUND_TITLE, robots: { index: false } };
  const handle = profile.username ?? username;
  return {
    title: `${profile.name} (@${handle})`,
    description: [
      `Treinos de ${profile.name} na FGPOWER`,
      plural(profile.followerCount, "seguidor", "seguidores"),
      // The program line the page shows (hidden when its owner hides it).
      profile.activeProgramName ? `treinando ${profile.activeProgramName}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    // Search engines index a profile only when its owner is public AND findable.
    robots: { index: profile.isPublicAccount && profile.discoverable, follow: true },
  };
}

/** "?p=2" → 2 (1…PROFILE_MAX_PAGES; anything else is the first page). */
function pageOf(value: string | string[] | undefined): number {
  const n = typeof value === "string" && /^\d{1,2}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(n, 1), PROFILE_MAX_PAGES);
}

export default async function PublicProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const { viewerId, profile } = await loadProfile(username);
  if (!profile) notFound();

  const isOwner = viewerId === profile.id;
  const page = pageOf(sp.p);
  const [{ items: activities, hasMore }, gaveFg, sessionEnded] = await Promise.all([
    getProfileActivities(profile.id, viewerId, profile.canViewActivity, { limit: PROFILE_PAGE_SIZE * page }),
    viewerId && !isOwner ? hasEverGivenFg(viewerId) : true,
    // Signed out, but the browser still sent a session cookie: the session
    // ended (another device signed out, or it expired on the server) —
    // typically found by a tap on Seguir, whose re-render lands here. Say so.
    viewerId ? false : hadSessionCookie(),
  ]);
  const handle = profile.username ?? username;
  const relation: FollowRelation = profile.isFollowing ? "FOLLOWING" : profile.hasPendingRequest ? "REQUESTED" : "NONE";
  // Signed-out visitors (usually from a shared link) sign in and land back here.
  const returnTo = profileHref(handle);
  const signInHref = `/login?next=${encodeURIComponent(returnTo)}`;
  // Until the viewer's first FG, the first workout here explains it (W-147).
  const hintId = gaveFg
    ? null
    : (activities.find((a) => a.type === "WORKOUT" && !milestoneStampOf(a.summary))?.id ?? null);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      {viewerId ? <BackLink fallbackHref={isOwner ? "/app/profile" : "/app/feed"} className="-mt-2 mb-2" /> : null}

      <div className="flex items-center gap-4">
        <Avatar src={profile.image} name={profile.name} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold [overflow-wrap:anywhere]">{profile.name}</h1>
          <p className="truncate text-sm text-muted">@{handle}</p>
        </div>
      </div>

      {profile.bio ? <p className="mt-3 text-sm text-foreground/90 [overflow-wrap:anywhere]">{profile.bio}</p> : null}

      {/* The follower count follows the viewer's Seguir / Deixar de seguir below it. */}
      <FollowCountScope userId={profile.id}>
        {isOwner ? (
          <div className="mt-1 flex gap-4 text-sm text-muted">
            <Link
              href="/app/profile/seguidores"
              aria-label={`${plural(profile.followerCount, "seguidor", "seguidores")} — ver lista`}
              className={COUNT_LINK}
            >
              <span>
                <strong className="text-foreground">{formatNumber(profile.followerCount, 0)}</strong>{" "}
                {pluralWord(profile.followerCount, "seguidor", "seguidores")}
              </span>
            </Link>
            <Link
              href="/app/profile/seguindo"
              aria-label={`Seguindo ${plural(profile.followingCount, "pessoa", "pessoas")} — ver lista`}
              className={COUNT_LINK}
            >
              <span>
                <strong className="text-foreground">{formatNumber(profile.followingCount, 0)}</strong> seguindo
              </span>
            </Link>
          </div>
        ) : (
          <div className="mt-3 flex gap-4 text-sm text-muted">
            <span data-follower-count>
              <LiveFollowerCount userId={profile.id} count={profile.followerCount} relation={relation} />
            </span>
            <span>
              <strong className="text-foreground">{formatNumber(profile.followingCount, 0)}</strong> seguindo
            </span>
          </div>
        )}

        <ProgramLine profile={profile} signedIn={viewerId !== null} isOwner={isOwner} />

        {viewerId && !isOwner ? (
          <div className="mt-4 flex items-start gap-2">
            <FollowButton
              targetUserId={profile.id}
              username={profile.username}
              name={profile.name}
              initialRelation={relation}
              isPrivate={!profile.isPublicAccount}
            />
            <ProfileMenu
              user={{ id: profile.id, username: profile.username, name: profile.name }}
              followsViewer={profile.followsViewer}
            />
          </div>
        ) : null}
      </FollowCountScope>
      {isOwner ? (
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/settings">Editar perfil</Link>
          </Button>
          <ShareProfileButton username={handle} name={profile.name} />
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

      <section className="mt-8" aria-labelledby="atividade">
        <SectionHead
          id="atividade"
          label="Atividade"
          count={activities.length > 0 ? plural(activities.length, "atividade", "atividades") : undefined}
        />
        <div className="mt-4">
          {!profile.canViewActivity ? (
            <p className="text-sm text-muted">Esta conta é privada. Siga para ver a atividade.</p>
          ) : activities.length === 0 ? (
            isOwner ? (
              <OwnerEmptyState visibility={profile.defaultWorkoutVisibility} />
            ) : (
              <p className="text-sm text-muted">Nenhuma atividade pública ainda.</p>
            )
          ) : (
            <div className="flex flex-col gap-4">
              {activities.map((a, i) => (
                // Focusable (-1) so "Carregar mais" can land focus on the first new card (FocusLanding).
                <div key={a.id} id={`treino-${i + 1}`} tabIndex={-1} className={LANDING_CARD}>
                  <ActivityCard
                    isOwn={isOwner}
                    signInReturnTo={viewerId ? undefined : returnTo}
                    fgHint={a.id === hintId}
                    activity={{
                      id: a.id,
                      sessionId: a.sessionId,
                      caption: a.caption,
                      createdAt: a.createdAt,
                      fgCount: a.fgCount,
                      hasGivenFg: a.hasGivenFg,
                      user: { name: profile.name, username: profile.username, image: profile.image },
                      summary: a.summary as unknown as WorkoutActivitySummary,
                      showDetailedLoads: a.showDetailedLoads,
                      // Who sees it: only on the owner's own workouts (W-144).
                      visibility: isOwner && a.type === "WORKOUT" ? a.visibility : undefined,
                    }}
                  />
                </div>
              ))}
              <ProfileEnd handle={handle} page={page} shown={activities.length} hasMore={hasMore} />
            </div>
          )}
        </div>
      </section>

      {!viewerId && !sessionEnded ? <JoinCta name={profile.name} handle={profile.username} returnTo={returnTo} /> : null}
    </div>
  );
}

/**
 * "Treinando: GD 1" — a link to the program's dossier when it comes from a
 * published template (W-146), with a way to train it too; a custom program
 * stays a plain badge.
 */
function ProgramLine({ profile, signedIn, isOwner }: { profile: PublicProfile; signedIn: boolean; isOwner: boolean }) {
  if (!profile.activeProgramName) return null;
  const slug = profile.activeProgramTemplateSlug;
  if (!slug) {
    return (
      <Badge variant="accent" className="mt-3 w-fit max-w-full">
        <span className="truncate">Treinando: {profile.activeProgramName}</span>
      </Badge>
    );
  }
  const href = signedIn ? `/app/programs/templates/${slug}` : `/programs/${slug}`;
  return (
    <div className="mt-3 flex flex-col items-start gap-0.5">
      <Link href={href} className="hit max-w-full">
        <Badge variant="accent" className="max-w-full hover:underline">
          <span className="truncate">Treinando: {profile.activeProgramName}</span>
        </Badge>
      </Link>
      {signedIn && !isOwner ? (
        profile.sameProgramAsViewer ? (
          <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Vocês treinam o mesmo programa
          </p>
        ) : (
          <Link href={href} className={LINK}>
            Treinar o mesmo programa →
          </Link>
        )
      ) : null}
    </div>
  );
}

/**
 * The owner's empty profile says why it's empty, by how their workouts are
 * published (W-048 §6): private ones never show here; with Seguidores or
 * Público the next finished workout will.
 */
function OwnerEmptyState({ visibility }: { visibility: PublicProfile["defaultWorkoutVisibility"] }) {
  if (visibility === "FOLLOWERS" || visibility === "PUBLIC") {
    return (
      <div className="border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
        <p className="font-medium">Nenhum treino publicado ainda.</p>
        <p className="mt-0.5 text-muted">
          Ao terminar um treino, ele aparece aqui para seus seguidores (ou para todos). Dá para mudar em cada resumo.
        </p>
        <Link href="/app/settings#privacidade" className={LINK}>
          Ajustar padrão
        </Link>
      </div>
    );
  }
  return (
    <div className="border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
      <p className="font-medium">Seus treinos são privados.</p>
      <p className="mt-0.5 text-muted">
        Para um treino aparecer aqui, compartilhe-o no resumo dele — para seguidores ou para todos.
      </p>
      <Link href="/app/history" className={LINK}>
        Abrir histórico
      </Link>
    </div>
  );
}

/** Under a profile's list: "Carregar mais" (20 more, landing on the first new card), up to 120. */
function ProfileEnd({ handle, page, shown, hasMore }: { handle: string; page: number; shown: number; hasMore: boolean }) {
  return (
    <div className="mt-2">
      <FocusLanding key={page} />
      <p role="status" className="sr-only">
        {`Mostrando ${plural(shown, "treino", "treinos")}`}
      </p>
      {hasMore && page < PROFILE_MAX_PAGES ? (
        <Button variant="outline" className="w-full" asChild>
          <Link href={`${profileHref(handle)}?p=${page + 1}#treino-${shown + 1}`} replace data-load-more>
            Carregar mais
          </Link>
        </Button>
      ) : hasMore ? (
        <p className="text-center text-sm text-muted">Mostrando os 120 treinos mais recentes.</p>
      ) : null}
    </div>
  );
}
