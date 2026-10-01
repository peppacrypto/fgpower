import type { Metadata } from "next";
import Link from "next/link";
import { GCohort } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { FEED_MAX_PAGES, FEED_PAGE_SIZE, getFeed, hasEverGivenFg } from "@/lib/data/social";
import { communityActivities } from "@/lib/data/discover";
import { ActivityCard } from "@/components/social/activity-card";
import { milestoneStampOf } from "@/components/social/milestone-stamp";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Masthead } from "@/components/ui/masthead";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";
import type { WorkoutActivitySummary } from "@/lib/social/activity-summary";
import { DeletedNotice } from "./deleted-notice";
import { FocusLanding } from "./focus-landing";

export const metadata: Metadata = { title: "Feed" };

/** A card's wrapper, where "Carregar mais" lands: a scroll margin, and a ring only for keyboard focus. */
const LANDING_CARD = "scroll-mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** "?p=3" → 3 (1…FEED_MAX_PAGES; anything else is the first page). */
function pageOf(value: string | string[] | undefined): number {
  const n = typeof value === "string" && /^\d{1,2}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(n, 1), FEED_MAX_PAGES);
}

type FeedRow = Awaited<ReturnType<typeof getFeed>>["items"][number];

export default async function FeedPage({ searchParams }: PageProps<"/app/feed">) {
  const [sp, user] = await Promise.all([searchParams, requireUser()]);
  const page = pageOf(sp.p);
  const deleted = sp.excluida === "1";
  const [{ items, hasMore }, gaveFg] = await Promise.all([
    getFeed(user.id, { limit: FEED_PAGE_SIZE * page }),
    hasEverGivenFg(user.id),
  ]);
  // Nothing from people you follow yet: a few public workouts to start from.
  const community = items.length === 0 ? await communityActivities(user.id) : [];
  // Until the first FG, the first workout of someone else explains it (W-147).
  const hintId = gaveFg ? null : firstOthersWorkout(items.length > 0 ? items : community, user.id);

  const card = (a: FeedRow, index: number) => {
    const isOwn = a.userId === user.id;
    return (
      // Focusable (-1) so "Carregar mais" can land focus on the first new card (FocusLanding).
      <div key={a.id} id={`treino-${index + 1}`} tabIndex={-1} className={LANDING_CARD}>
        <ActivityCard
          currentUsername={user.username}
          isOwn={isOwn}
          fgHint={a.id === hintId}
          activity={{
            id: a.id,
            sessionId: a.sessionId,
            caption: a.caption,
            createdAt: a.createdAt,
            fgCount: a.fgCount,
            hasGivenFg: a.hasGivenFg,
            user: a.user,
            summary: a.summary as unknown as WorkoutActivitySummary,
            showDetailedLoads: a.showDetailedLoads,
            // Who sees it: only on your own workouts (W-144).
            visibility: isOwn && a.type === "WORKOUT" ? a.visibility : undefined,
          }}
        />
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <Masthead
        kicker="Quem você segue"
        title="Feed"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/discover">
              <GCohort className="size-4" />
              Descobrir
            </Link>
          </Button>
        }
      />

      <DeletedNotice show={deleted} />

      {items.length === 0 ? (
        <>
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
          {community.length > 0 ? (
            <section className="mt-10" aria-labelledby="da-comunidade">
              <SectionHead id="da-comunidade" label="Da comunidade" />
              <p className="mt-2 text-sm text-muted">Treinos públicos recentes. Siga quem te inspira para ver mais aqui.</p>
              <div className="mt-4 flex flex-col gap-4">{community.map((a, i) => card(a, i))}</div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-8" aria-labelledby="treinos-recentes">
          <SectionHead id="treinos-recentes" label="Treinos recentes" count={plural(items.length, "atividade", "atividades")} />
          <div className="mt-4 flex flex-col gap-4">{items.map((a, i) => card(a, i))}</div>
          <FeedEnd page={page} shown={items.length} hasMore={hasMore} />
        </section>
      )}
    </div>
  );
}

/**
 * Under the list: "Carregar mais" grows the same page (?p=2 shows 30 cards),
 * landing on the first new card; after 8 steps older workouts live on each
 * profile; "Fim do feed" when there is nothing older.
 */
function FeedEnd({ page, shown, hasMore }: { page: number; shown: number; hasMore: boolean }) {
  return (
    <div className="mt-6">
      <FocusLanding key={page} />
      <p role="status" className="sr-only">
        {`Mostrando ${plural(shown, "treino", "treinos")}`}
      </p>
      {hasMore && page < FEED_MAX_PAGES ? (
        <Button variant="outline" className="w-full" asChild>
          {/* The hash lands the page on the first card it adds (Next scrolls to it once rendered). */}
          <Link href={`/app/feed?p=${page + 1}#treino-${shown + 1}`} replace data-load-more>
            Carregar mais
          </Link>
        </Button>
      ) : hasMore ? (
        <p className="text-center text-sm text-muted">Treinos mais antigos ficam no perfil de cada pessoa.</p>
      ) : shown >= FEED_PAGE_SIZE ? (
        <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Fim do feed</p>
      ) : null}
    </div>
  );
}

/** The first workout card (not a stamp) by someone other than the viewer. */
function firstOthersWorkout(rows: FeedRow[], viewerId: string): string | null {
  const row = rows.find((a) => a.userId !== viewerId && a.type === "WORKOUT" && !milestoneStampOf(a.summary));
  return row?.id ?? null;
}
