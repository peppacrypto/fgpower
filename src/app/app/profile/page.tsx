import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Heart, Settings, ExternalLink } from "lucide-react";
import { GCohort } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import { listFavoriteExercises } from "@/lib/data/favorites";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExerciseCard } from "@/components/exercises/exercise-card";

export const metadata: Metadata = { title: "Perfil" };

const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, favorites, sessionCount, followerCount, followingCount] = await Promise.all([
    getProfile(user.id),
    listFavoriteExercises(user.id),
    prisma.workoutSession.count({ where: { userId: user.id, status: "COMPLETED" } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        <Avatar src={user.image} name={user.name} size={64} />
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">{profile?.displayName ?? user.name}</h1>
          {user.username ? <p className="text-sm text-muted">@{user.username}</p> : null}
        </div>
        <Button variant="outline" size="icon" asChild>
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

      {user.username ? (
        <Link
          href={`/u/${user.username}`}
          className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          Ver perfil público <ExternalLink className="size-3.5" />
        </Link>
      ) : (
        <Link href="/app/settings" className="mt-3 inline-block text-sm text-accent hover:underline">
          Escolha um nome de usuário público em Configurações
        </Link>
      )}

      <div className="mt-5 flex gap-2 sm:hidden">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link href="/app/feed">
            <GCohort className="size-4" />
            Feed
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link href="/app/notifications">
            <Bell className="size-4" />
            Notificações
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-xl font-bold tabular-nums">{sessionCount}</p>
            <p className="text-xs text-muted">Treinos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-xl font-bold tabular-nums">{followerCount}</p>
            <p className="text-xs text-muted">Seguidores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-xl font-bold tabular-nums">{followingCount}</p>
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
