import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_SELECT, toPublicUser } from "@/lib/data/social/public-user";
import { givenFgIds } from "@/lib/data/social/feed";
import { toCardSummary } from "@/lib/social/activity-summary";
import { loadPeople, NOT_BANNED, socialExclusions, type PersonRowData } from "@/lib/social/people";
import { formatSpDaysAgo } from "@/lib/training/stale";

/**
 * Descobrir's suggestions and the empty feed's "Da comunidade" (W-047).
 *
 * People are suggested only when they chose to be found (discoverable, with
 * a handle, not banned), never the viewer, anyone they already follow or
 * asked to, or anyone blocked either way. Workouts are advertised to
 * strangers only when the workout is PUBLIC *and* the account is public: a
 * PUBLIC workout of a private account opens by its link, but it is never
 * put in front of people who don't follow them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DISCOVERABLE: Prisma.UserWhereInput = {
  username: { not: null },
  profile: { discoverable: true },
  AND: [NOT_BANNED],
};

/** A suggested person: their row, and why they are suggested ("Treinando: GD 1"). */
export interface SuggestedPerson {
  person: PersonRowData;
  meta: string;
}

async function excludedIds(viewerId: string): Promise<string[]> {
  const { blocked, following, requested } = await socialExclusions(viewerId);
  return [viewerId, ...blocked, ...following, ...requested];
}

/**
 * People running a program from the same template as the viewer's active one
 * (and showing it), most recently trained first. Nothing when the viewer's
 * program isn't from a template.
 */
export async function sameProgramPeople(viewerId: string, limit = 8): Promise<SuggestedPerson[]> {
  const mine = await prisma.userProgram.findFirst({
    where: { userId: viewerId, status: "ACTIVE", sourceTemplateId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { sourceTemplateId: true },
  });
  if (!mine?.sourceTemplateId) return [];
  const excluded = await excludedIds(viewerId);
  const candidates = await prisma.user.findMany({
    where: {
      AND: [
        DISCOVERABLE,
        { id: { notIn: excluded } },
        { profile: { showCurrentProgram: true } },
        { programs: { some: { status: "ACTIVE", sourceTemplateId: mine.sourceTemplateId } } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 30,
    select: { id: true },
  });
  if (candidates.length === 0) return [];
  const ids = candidates.map((c) => c.id);
  const [lastWorkouts, people] = await Promise.all([
    prisma.workoutSession.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, status: "COMPLETED" },
      _max: { finishedAt: true },
    }),
    loadPeople(viewerId, ids),
  ]);
  const lastAt = new Map(lastWorkouts.map((w) => [w.userId, w._max.finishedAt?.getTime() ?? 0]));
  return ids
    .map((id) => people.get(id))
    .filter((p): p is PersonRowData => p !== undefined && p.programName !== null)
    // Stable: people with no workout keep the newest-account order at the end.
    .sort((a, b) => (lastAt.get(b.id) ?? 0) - (lastAt.get(a.id) ?? 0))
    .slice(0, limit)
    .map((person) => ({ person, meta: `Treinando: ${person.programName}` }));
}

/**
 * The latest PUBLIC workout of each public, discoverable account that
 * published one in [since, now], newest first, `maxAuthors` people at most:
 * the newest per author first (one grouped query), then those rows — so a
 * prolific author never crowds everyone else out.
 */
async function recentPublicWorkouts(since: Date, now: Date, excluded: string[], maxAuthors: number) {
  const where: Prisma.ActivityWhereInput = {
    type: "WORKOUT",
    visibility: "PUBLIC",
    createdAt: { gte: since, lte: now },
    userId: { notIn: excluded },
    user: { AND: [DISCOVERABLE, { profile: { isPublicAccount: true } }] },
  };
  const latest = await prisma.activity.groupBy({
    by: ["userId"],
    where,
    _max: { createdAt: true },
    orderBy: [{ _max: { createdAt: "desc" } }, { userId: "asc" }],
    take: maxAuthors,
  });
  if (latest.length === 0) return [];
  const rows = await prisma.activity.findMany({
    where: { AND: [where, { OR: latest.map((g) => ({ userId: g.userId, createdAt: g._max.createdAt ?? now })) }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
  // Two workouts saved at the same instant: keep one.
  const seen = new Set<string>();
  return rows.filter((a) => !seen.has(a.userId) && seen.add(a.userId));
}

/**
 * People who trained this week (7 days) and published it for everyone:
 * "Treinou há 2 dias · Push A". `skip` leaves out people already
 * suggested above, so nobody shows twice on the page.
 */
export async function activeThisWeek(
  viewerId: string,
  { limit = 6, skip = [], now = new Date() }: { limit?: number; skip?: string[]; now?: Date } = {},
): Promise<SuggestedPerson[]> {
  const excluded = [...(await excludedIds(viewerId)), ...skip];
  const workouts = await recentPublicWorkouts(new Date(now.getTime() - 7 * DAY_MS), now, excluded, limit);
  const people = await loadPeople(viewerId, workouts.map((w) => w.userId));
  return workouts.flatMap((w) => {
    const person = people.get(w.userId);
    if (!person) return [];
    // When first: on a narrow row a long workout name gives way, never the time.
    return [{ person, meta: `Treinou ${formatSpDaysAgo(w.createdAt, now)} · ${toCardSummary(w.summary).workoutName}` }];
  });
}

/**
 * The empty feed's "Da comunidade": up to 3 recent (14 days) PUBLIC workouts
 * of public, discoverable accounts, one per author, as full feed rows.
 */
export async function communityActivities(viewerId: string, { limit = 3, now = new Date() } = {}) {
  const rows = await recentPublicWorkouts(new Date(now.getTime() - 14 * DAY_MS), now, await excludedIds(viewerId), limit);
  const given = await givenFgIds(viewerId, rows.map((a) => a.id));
  return rows.map((a) => ({ ...a, user: toPublicUser(a.user), hasGivenFg: given.has(a.id) }));
}
