import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookOpen, Heart, History, Settings, ExternalLink } from "lucide-react";
import { GArrow, GCohort } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getOwnIdentity, getProfile, getPublicProfileOrigin } from "@/lib/data/profile";
import { listFavoriteExercises } from "@/lib/data/favorites";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { formatNumber, pluralWord } from "@/lib/utils/format";
import { publicProfileLabel } from "@/lib/validation/username";
import { LogoutButton } from "./logout-button";

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
  const [profile, identity, favorites, sessionCount, followerCount, followingCount, publicOrigin] = await Promise.all([
    getProfile(user.id),
    // Handle and name from the DB: the session cookie cache can be minutes stale.
    getOwnIdentity(user.id),
    listFavoriteExercises(user.id),
    prisma.workoutSession.count({ where: { userId: user.id, status: "COMPLETED" } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    getPublicProfileOrigin(),
  ]);
  const name = identity?.name ?? user.name;
  const username = identity?.username ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        <Avatar src={user.image} name={name} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">{name}</h1>
          {identity?.handle ? <p className="truncate text-sm text-muted">@{identity.handle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/app/settings" aria-label="Configurações">
              <Settings className="size-4" />
            </Link>
          </Button>
          <LogoutButton />
        </div>
      </div>

      {profile?.bio ? <p className="mt-3 text-sm text-foreground/90">{profile.bio}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {profile ? <Badge variant="accent">{GOAL_LABEL[profile.goal]}</Badge> : null}
        {profile ? <Badge>{profile.daysPerWeek}x/semana</Badge> : null}
      </div>

      {username ? (
        <Link
          href={`/u/${username}`}
          className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          Ver perfil público <ExternalLink className="size-3.5" />
        </Link>
      ) : (
        <Link href="/app/settings" className="mt-3 inline-block text-sm text-accent hover:underline">
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
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-xl font-bold tabular-nums">{formatNumber(followerCount, 0)}</p>
            <p className="text-xs text-muted">{pluralWord(followerCount, "Seguidor", "Seguidores")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-xl font-bold tabular-nums">{formatNumber(followingCount, 0)}</p>
            <p className="text-xs text-muted">Seguindo</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Heart className="size-4" />
          Favoritos
        </h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-muted">Nenhum exercício favoritado ainda.</p>
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
      </div>
    </div>
  );
}
