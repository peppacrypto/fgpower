import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookOpen, Heart, History, Settings, ExternalLink } from "lucide-react";
import { SectionHead } from "@/components/ui/section-head";
import { GArrow, GCohort } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getOwnIdentity, getProfile, getPublicProfileOrigin } from "@/lib/data/profile";
import { listFavoriteExercises } from "@/lib/data/favorites";
import { getGraphCounts } from "@/lib/data/social";
import { prisma } from "@/lib/db";
import { profileHref } from "@/lib/social/links";
import { ShareProfileButton } from "@/components/share/share-profile-button";
import { UnreadCountPip } from "@/components/nav/unread-provider";
import { Avatar } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { formatNumber, plural, pluralWord } from "@/lib/utils/format";
import { publicProfileLabel } from "@/lib/validation/username";

export const metadata: Metadata = { title: "Perfil" };

const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
  FAT_LOSS: "Emagrecer / definir",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, identity, favorites, sessionCount, graph, publicOrigin] = await Promise.all([
    getProfile(user.id),
    // Handle and name from the DB: the session cookie cache can be minutes stale.
    getOwnIdentity(user.id),
    listFavoriteExercises(user.id),
    prisma.workoutSession.count({ where: { userId: user.id, status: "COMPLETED" } }),
    getGraphCounts(user.id),
    getPublicProfileOrigin(),
  ]);
  const { followers: followerCount, following: followingCount, requests: requestCount } = graph;
  const name = identity?.name ?? user.name;
  const username = identity?.username ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Masthead. Only the gear here: signing out lives in Configurações → Dados e conta. */}
      <div className="flex items-center gap-4">
        <Avatar src={user.image} name={name} size={64} />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Perfil</span>
          <h1 className="text-display text-2xl font-extrabold [overflow-wrap:anywhere]">{name}</h1>
          {identity?.handle ? <p className="truncate font-mono text-xs text-muted">@{identity.handle}</p> : null}
        </div>
        <Button variant="outline" size="icon" asChild className="shrink-0">
          <Link href="/app/settings" aria-label="Configurações">
            <Settings className="size-4" />
          </Link>
        </Button>
      </div>

      {profile?.bio ? <p className="mt-3 text-sm text-foreground/90">{profile.bio}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {profile ? <Badge variant="accent">{GOAL_LABEL[profile.goal]}</Badge> : null}
        {profile ? <Badge>{profile.daysPerWeek}x/semana</Badge> : null}
      </div>

      {username ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href={profileHref(username)}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent underline decoration-[color-mix(in_oklab,var(--accent)_35%,transparent)] underline-offset-[3px] hover:decoration-accent"
          >
            Ver perfil público <ExternalLink aria-hidden className="size-3.5" />
          </Link>
          <ShareProfileButton username={username} name={name} />
        </div>
      ) : (
        <Link
          href="/app/settings"
          className="mt-1 -mb-2 inline-flex min-h-11 items-center text-sm font-medium text-accent underline decoration-[color-mix(in_oklab,var(--accent)_35%,transparent)] underline-offset-[3px] hover:decoration-accent"
        >
          Escolha seu @usuário para ser encontrado e seguido
        </Link>
      )}

      {/* Accounts given a handle by the backfill start out of Descobrir (and
          anyone can switch it off): say where the profile lives and how to be
          found, instead of leaving either unsaid. */}
      {username && profile && !profile.discoverable ? (
        <div className="mt-4 border-l-2 border-l-accent bg-surface-2 px-3.5 py-3 text-sm">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Seu endereço público</p>
          <p className="mt-1 font-mono text-xs text-foreground [overflow-wrap:anywhere]">
            {publicProfileLabel(username, publicOrigin)}
          </p>
          <p className="mt-1.5 text-muted">
            Você não aparece em Descobrir: só quem tem o link abre seu perfil. Para amigos te acharem pela busca, ative a
            descoberta.
          </p>
          <Link
            href="/app/settings#privacidade"
            className="mt-2 inline-block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent underline decoration-2 underline-offset-[3px]"
          >
            Ajustar privacidade
          </Link>
        </div>
      ) : null}

      {/* On the phone these have no tab; the desktop sidebar links them directly. */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/feed">
            <GCohort className="size-4" />
            Feed
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/notifications">
            <Bell className="size-4" />
            Notificações
            <UnreadCountPip />
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/history">
            <History className="size-4" />
            Histórico
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/science">
            <BookOpen className="size-4" />
            Ciência
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Link href="/app/history" aria-label={`${formatNumber(sessionCount, 0)} ${pluralWord(sessionCount, "treino", "treinos")} — ver histórico`}>
          <Card className="is-link h-full">
            <CardContent className="py-4">
              <p className="font-mono text-xl font-bold tabular-nums">{formatNumber(sessionCount, 0)}</p>
              <p className="flex items-center justify-center gap-1 text-xs text-muted">
                {pluralWord(sessionCount, "Treino", "Treinos")}
                <GArrow className="size-3" />
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link
          href="/app/profile/seguidores"
          aria-label={`${plural(followerCount, "seguidor", "seguidores")}${
            requestCount > 0 ? ` e ${plural(requestCount, "pedido", "pedidos")} para seguir` : ""
          } — ver lista`}
        >
          <Card className="is-link h-full">
            <CardContent className="py-4">
              <p className="font-mono text-xl font-bold tabular-nums">{formatNumber(followerCount, 0)}</p>
              <p className="flex items-center justify-center gap-1 text-xs text-muted">
                {pluralWord(followerCount, "Seguidor", "Seguidores")}
                <GArrow className="size-3" />
              </p>
              {requestCount > 0 ? (
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                  {plural(requestCount, "pedido", "pedidos")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/profile/seguindo" aria-label={`Seguindo ${plural(followingCount, "pessoa", "pessoas")} — ver lista`}>
          <Card className="is-link h-full">
            <CardContent className="py-4">
              <p className="font-mono text-xl font-bold tabular-nums">{formatNumber(followingCount, 0)}</p>
              <p className="flex items-center justify-center gap-1 text-xs text-muted">
                Seguindo
                <GArrow className="size-3" />
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <section className="mt-8">
        <SectionHead
          label="Favoritos"
          count={favorites.length > 0 ? plural(favorites.length, "exercício", "exercícios") : undefined}
          className="mb-3"
        />
        {favorites.length === 0 ? (
          <div className="border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
            <p className="font-medium">Nenhum exercício favoritado ainda.</p>
            <p className="mt-0.5 text-muted">
              Toque em <Heart className="inline size-3.5 align-[-2px]" aria-hidden />
              <span className="sr-only">Adicionar aos favoritos</span> na página de um exercício para guardá-lo aqui.
            </p>
            <Link
              href="/app/exercises"
              className="mt-1 inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Ver exercícios
              <GArrow className="size-3" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {favorites.map((f) => (
              <ExerciseCard
                key={f.exerciseId}
                exercise={{
                  id: f.exercise.id,
                  slug: f.exercise.slug,
                  nameEn: f.exercise.nameEn,
                  namePt: f.exercise.namePt,
                  difficulty: f.exercise.difficulty,
                  mechanics: f.exercise.mechanics,
                  isCurated: f.exercise.isCurated,
                  equipment: f.exercise.equipment,
                  movementPattern: null,
                  muscles: [],
                  media: f.exercise.media,
                }}
                href={`/app/exercises/${f.exercise.slug}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
