import type { Metadata } from "next";
import Link from "next/link";
import { GCohort } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getFeed } from "@/lib/data/social";
import { ActivityCard } from "@/components/social/activity-card";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  const user = await requireUser();
  const { items } = await getFeed(user.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Feed</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/discover">
            <GCohort className="size-4" />
            Descobrir
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<GCohort className="size-8" />}
            title="Seu feed está vazio"
            description="Siga outros atletas para ver os treinos deles aqui, ou compartilhe o seu."
            action={
              <Button asChild>
                <Link href="/app/discover">Encontrar pessoas</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {items.map((a) => (
            <ActivityCard
              key={a.id}
              currentUsername={user.username}
              activity={{
                id: a.id,
                sessionId: a.sessionId,
                caption: a.caption,
                createdAt: a.createdAt,
                fgCount: a.fgCount,
                hasGivenFg: a.hasGivenFg,
                user: a.user,
                summary: a.summary as unknown as WorkoutActivitySummary,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
