import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-user";
import { isAdminUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { Masthead } from "@/components/ui/masthead";
import { PUBLIC_USER_SELECT, toPublicUser } from "@/lib/data/social/public-user";
import { profileHref } from "@/lib/social/links";
import { REPORT_REASON_LABEL, goneWorkoutOf, isReportReason } from "@/lib/social/notification-reports-core";
import { plural } from "@/lib/utils/format";
import { formatFullDateTime, formatRelativeTime } from "@/lib/utils/relative-time";
import { cn } from "@/lib/utils/cn";
import { ReportActions, ResolvedActions, ResultNotice } from "./report-row";

export const metadata: Metadata = { title: "Admin · Denúncias" };

const RESOLVED_LIMIT = 50;

const STATUS_LABEL: Record<string, string> = {
  REVIEWED: "Revisada",
  ACTIONED: "Ação tomada",
  DISMISSED: "Descartada",
};

const VISIBILITY_LABEL: Record<string, string> = { PRIVATE: "Privado", FOLLOWERS: "Seguidores", PUBLIC: "Público" };

type Person = { id: string; name: string; username: string | null };

/** A report's snapshot (what was reported, as it stood then), read defensively. */
function snapshotOf(value: unknown) {
  const s = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const person = (v: unknown): Person | null => {
    const p = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    return p && typeof p.id === "string" ? { id: p.id, name: str(p.name) ?? "?", username: str(p.username) } : null;
  };
  return {
    kind: s.kind === "activity" || s.kind === "user" ? s.kind : null,
    workoutName: str(s.workoutName),
    caption: str(s.caption),
    visibility: str(s.visibility),
    createdAt: str(s.createdAt),
    author: person(s.author),
    user: person(s.user),
    bio: str((s.user as Record<string, unknown> | undefined)?.bio),
  };
}

/**
 * The moderation queue (decision 15): open reports with everything needed to
 * decide — who reported, about whom, the reported workout as it is now (read
 * straight from the DB: this page is admin-only) or as it was reported — and
 * the decisions: revisar, descartar, ocultar o treino, excluir a publicação,
 * banir. "Resolvidas" lists the last decisions and lifts a ban.
 *
 * The page checks for an admin itself: the admin layout's check doesn't guard
 * it. A client navigation renders only the segments that change, so a request
 * that claims the layout is already on screen gets this page alone — without
 * the check, anyone (signed out too) could read the queue.
 */
export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const tab = sp.status === "resolvidas" ? "resolved" : "open";
  const now = new Date();

  const [reports, openCount, byActivity, withoutPost] = await Promise.all([
    prisma.userReport.findMany({
      where: tab === "open" ? { status: "OPEN" } : { status: { not: "OPEN" } },
      orderBy: tab === "open" ? [{ createdAt: "desc" }, { id: "desc" }] : [{ resolvedAt: "desc" }, { id: "desc" }],
      take: tab === "open" ? 200 : RESOLVED_LIMIT,
      select: {
        id: true,
        reason: true,
        details: true,
        status: true,
        snapshot: true,
        createdAt: true,
        resolvedAt: true,
        resolutionNote: true,
        activityId: true,
        reportedUserId: true,
        reporter: { select: PUBLIC_USER_SELECT },
        reportedUser: { select: { ...PUBLIC_USER_SELECT, banned: true, banReason: true, role: true, email: true } },
        resolvedBy: { select: PUBLIC_USER_SELECT },
        activity: {
          select: {
            id: true,
            type: true,
            visibility: true,
            caption: true,
            summary: true,
            createdAt: true,
            moderatedAt: true,
            user: { select: { ...PUBLIC_USER_SELECT, banned: true, role: true, email: true } },
          },
        },
      },
    }),
    prisma.userReport.count({ where: { status: "OPEN" } }),
    prisma.userReport.groupBy({ by: ["activityId"], where: { status: "OPEN", activityId: { not: null } }, _count: { _all: true } }),
    // Open reports with no live post: about a person, or about a post deleted since (few).
    prisma.userReport.findMany({
      where: { status: "OPEN", activityId: null, reportedUserId: { not: null } },
      select: { reportedUserId: true, snapshot: true },
    }),
  ]);
  const openByActivity = new Map(byActivity.map((g) => [g.activityId, g._count._all]));
  // The same target as moderateReport settles together: the person, or one deleted post.
  const targetKey = (r: { reportedUserId: string | null; snapshot: unknown }) => `${r.reportedUserId}|${goneWorkoutOf(r.snapshot) ?? ""}`;
  const openByTarget = new Map<string, number>();
  for (const r of withoutPost) openByTarget.set(targetKey(r), (openByTarget.get(targetKey(r)) ?? 0) + 1);
  const opensInApp = await workoutsTheAdminCanOpen(
    admin.id,
    reports.flatMap((r) => (r.activity ? [r.activity] : [])),
  );

  const notice =
    typeof sp.resolvida === "string" && Object.hasOwn(STATUS_LABEL, sp.resolvida)
      ? `Denúncia resolvida · ${STATUS_LABEL[sp.resolvida]}${Number(sp.n) > 1 ? ` · ${plural(Number(sp.n), "denúncia", "denúncias")} sobre o mesmo alvo` : ""}`
      : sp.desbanido === "1"
        ? "Banimento retirado."
        : null;

  return (
    <div className="max-w-3xl">
      <Masthead kicker="Admin" title="Denúncias" lead="Cada denúncia chega aqui. Quem denunciou e quem foi denunciado não são avisados da decisão." />
      <nav aria-label="Denúncias" className="mt-6 flex gap-1 border-b border-border">
        <TabLink href="/admin/reports" current={tab === "open"}>
          Abertas <span className="font-mono text-[11px] tabular-nums">{openCount}</span>
        </TabLink>
        <TabLink href="/admin/reports?status=resolvidas" current={tab === "resolved"}>
          Resolvidas
        </TabLink>
      </nav>

      {notice ? (
        <ResultNotice
          text={notice}
          stamp={`${openCount}:${reports.filter((r) => r.reportedUser?.banned === true).length}`}
        />
      ) : null}

      {reports.length === 0 ? (
        <p className="mt-6 border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm text-muted">
          {tab === "open" ? "Nenhuma denúncia aberta." : "Nenhuma denúncia resolvida ainda."}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {reports.map((r) => {
            const snap = snapshotOf(r.snapshot);
            const reporter = toPublicUser(r.reporter);
            // The person reported — or, for a workout report from before reports named one, the workout's author
            // (moderateReport bans the same person).
            const reported = r.reportedUser ?? r.activity?.user ?? null;
            const target = reported ? toPublicUser(reported) : (snap.author ?? snap.user);
            const banned = reported?.banned === true;
            // moderateReport never bans yourself or another admin: no button that can only fail.
            const bannable = reported !== null && !banned && reported.id !== admin.id && !isAdminUser(reported);
            const reason = isReportReason(r.reason) ? REPORT_REASON_LABEL[r.reason] : r.reason;
            const live = r.activity;
            const summary = (live?.summary ?? {}) as { workoutName?: unknown };
            const liveName = typeof summary.workoutName === "string" ? summary.workoutName : null;
            const aboutWorkout = r.activityId !== null || snap.kind === "activity";
            const openAboutTarget = r.activityId
              ? (openByActivity.get(r.activityId) ?? 0)
              : r.reportedUserId
                ? (openByTarget.get(targetKey(r)) ?? 0)
                : 0;
            const targetHandle = target ? (target.username ? `@${target.username}` : target.name) : null;
            return (
              <li key={r.id} className="reg-frame p-4" data-report={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tag tag--status tag--warn">{reason}</span>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                      {aboutWorkout ? "Treino" : "Perfil"}
                    </span>
                  </span>
                  <time dateTime={r.createdAt.toISOString()} title={formatFullDateTime(r.createdAt)} className="font-mono text-[11px] text-muted">
                    {formatRelativeTime(r.createdAt, now)}
                  </time>
                </div>

                <dl className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
                  <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Denunciante</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">
                    <PersonLink person={reporter} />
                  </dd>
                  <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Denunciado</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-2 [overflow-wrap:anywhere]">
                    {/* Nobody: an old workout report (it named no person) whose post is gone since. */}
                    {target ? <PersonLink person={target} /> : <span className="text-muted">Não identificado</span>}
                    {banned ? <span className="tag tag--status tag--bad">Banido</span> : null}
                  </dd>
                </dl>

                {r.details ? (
                  <p className="mt-3 border-l-2 border-l-border-strong pl-3 text-sm whitespace-pre-line [overflow-wrap:anywhere]">{r.details}</p>
                ) : null}

                {aboutWorkout ? (
                  <div className="mt-3 border border-border bg-surface-2 p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                      {live ? "Treino denunciado" : "Publicação excluída — como foi denunciada"}
                      {(live?.visibility ?? snap.visibility) ? (
                        <span className="tag tag--spec">{VISIBILITY_LABEL[live?.visibility ?? snap.visibility ?? ""] ?? live?.visibility}</span>
                      ) : null}
                      {live?.moderatedAt ? <span className="tag tag--status tag--bad">Ocultado</span> : null}
                    </p>
                    <p className="mt-1.5 font-semibold [overflow-wrap:anywhere]">{liveName ?? snap.workoutName ?? "Treino"}</p>
                    {(live ? live.caption : snap.caption) ? (
                      <p className="mt-1 whitespace-pre-line text-foreground/90 [overflow-wrap:anywhere]">“{live ? live.caption : snap.caption}”</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted">Sem legenda.</p>
                    )}
                    {live ? (
                      <p className="mt-1 font-mono text-[11px] text-muted">Publicado {formatRelativeTime(live.createdAt, now)}</p>
                    ) : null}
                    {live && opensInApp.has(live.id) ? (
                      <Link href={`/app/activity/${live.id}`} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-accent underline underline-offset-2">
                        Abrir no app
                      </Link>
                    ) : null}
                  </div>
                ) : snap.bio ? (
                  <div className="mt-3 border border-border bg-surface-2 p-3 text-sm">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Bio quando foi denunciado</p>
                    <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">{snap.bio}</p>
                  </div>
                ) : null}

                {tab === "open" && openAboutTarget > 1 ? (
                  <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-danger">
                    {plural(openAboutTarget, "denúncia aberta", "denúncias abertas")} sobre {aboutWorkout ? "este treino" : "esta conta"}
                  </p>
                ) : null}

                {tab === "open" ? (
                  <ReportActions
                    reportId={r.id}
                    canHide={Boolean(live) && !live?.moderatedAt}
                    canDelete={Boolean(live)}
                    banTarget={bannable ? targetHandle : null}
                  />
                ) : (
                  <div className="mt-4 border-t border-border pt-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={cn("tag tag--status", r.status === "ACTIONED" ? "tag--ok" : "tag--info")}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      <span className="font-mono text-[11px] text-muted">
                        {r.resolvedBy ? `por ${toPublicUser(r.resolvedBy).name}` : ""}
                        {r.resolvedAt ? ` · ${formatRelativeTime(r.resolvedAt, now)}` : ""}
                      </span>
                    </p>
                    {r.resolutionNote ? <p className="mt-1.5 text-foreground/90 [overflow-wrap:anywhere]">{r.resolutionNote}</p> : null}
                    {banned && reported ? <ResolvedActions userId={reported.id} handle={targetHandle ?? ""} /> : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The reported workouts "Abrir no app" really opens for this admin. The
 * activity page has no admin pass — it asks canViewActivity, as for anyone:
 * a followers-only post (the default) opens only for someone who follows its
 * author, and nothing opens across a block or from a banned author. Elsewhere
 * the link would land on "Esta página não existe", so it isn't offered: the
 * preview on the card is the evidence. Two queries for the whole page.
 */
async function workoutsTheAdminCanOpen(
  adminId: string,
  activities: { id: string; visibility: string; user: { id: string; banned: boolean | null } }[],
): Promise<Set<string>> {
  const authors = [...new Set(activities.filter((a) => a.user.id !== adminId).map((a) => a.user.id))];
  const [follows, blocks] =
    authors.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.follow.findMany({ where: { followerId: adminId, followingId: { in: authors } }, select: { followingId: true } }),
          prisma.userBlock.findMany({
            where: { OR: [{ blockerId: adminId, blockedId: { in: authors } }, { blockedId: adminId, blockerId: { in: authors } }] },
            select: { blockerId: true, blockedId: true },
          }),
        ]);
  const followed = new Set(follows.map((f) => f.followingId));
  const blocked = new Set(blocks.map((b) => (b.blockerId === adminId ? b.blockedId : b.blockerId)));
  return new Set(
    activities
      .filter(
        (a) =>
          a.user.id === adminId ||
          (a.visibility !== "PRIVATE" &&
            a.user.banned !== true &&
            !blocked.has(a.user.id) &&
            (a.visibility === "PUBLIC" || followed.has(a.user.id))),
      )
      .map((a) => a.id),
  );
}

function TabLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm",
        current ? "border-b-accent font-semibold text-foreground" : "border-b-transparent text-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function PersonLink({ person }: { person: Person }) {
  const label = (
    <>
      <span className="font-semibold">{person.name}</span>
      {person.username ? <span className="font-mono text-xs text-muted"> @{person.username}</span> : null}
    </>
  );
  return person.username ? (
    <Link href={profileHref(person.username)} className="hover:underline">
      {label}
    </Link>
  ) : (
    <span>{label}</span>
  );
}
