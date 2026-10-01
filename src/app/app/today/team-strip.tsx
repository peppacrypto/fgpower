import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { getOwnIdentity } from "@/lib/data/profile";
import { getTeamStrip } from "@/lib/data/social";
import type { ActionResult } from "@/lib/actions/result";
import { SectionHead } from "@/components/ui/section-head";
import { formatSpDaysAgo, spDaysBetween } from "@/lib/training/stale";
import { TeamActivityRow, TeamInvite } from "./team-actions";

/**
 * Today's "Da sua equipe" (W-139, owned by C2): the latest workouts of people
 * the user follows (7 days, FOLLOWERS/PUBLIC, not banned), with FG; following
 * nobody after the first finished workout, the "Treine com amigos" invite
 * (unless `allowInvite` is false: Today shows at most one optional prompt —
 * fatigue > weigh-in > team invite). An async server component that loads its
 * own data (lib/data/social getTeamStrip) and renders nothing when that fails,
 * so Today keeps working.
 */

/** "Agora não" on the invite, remembered for the account (UserDismissal). */
const INVITE_DISMISSAL = "team-invite";
/** A dismissed invite comes back after this long (the user may have friends by then). */
const INVITE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

const LINK =
  "inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline";

export async function TeamStrip({
  userId,
  now,
  finishedWorkouts,
  allowInvite,
}: {
  userId: string;
  now: Date;
  finishedWorkouts: number;
  allowInvite: boolean;
}) {
  let content: React.ReactNode = null;
  try {
    content = await teamStripContent({ userId, now, finishedWorkouts, allowInvite });
  } catch (err) {
    // Today never fails because of its social block.
    console.error("TeamStrip failed", err);
    return null;
  }
  return content;
}

async function teamStripContent({
  userId,
  now,
  finishedWorkouts,
  allowInvite,
}: {
  userId: string;
  now: Date;
  finishedWorkouts: number;
  allowInvite: boolean;
}) {
  const strip = await getTeamStrip(userId, now);

  if (strip.kind === "cold") {
    // The first workout comes first: a brand-new Today stays on the plan.
    if (!allowInvite || finishedWorkouts < 1) return null;
    const [dismissal, me] = await Promise.all([
      prisma.userDismissal.findUnique({ where: { userId_key: { userId, key: INVITE_DISMISSAL } } }),
      getOwnIdentity(userId),
    ]);
    // Still rendered once dismissed (then only its live region): see TeamInvite.
    return (
      <TeamInvite
        dismissed={dismissal !== null && now.getTime() - dismissal.createdAt.getTime() < INVITE_SNOOZE_MS}
        dismiss={dismissTeamInvite}
        username={me?.username ?? null}
        name={me?.name ?? ""}
      />
    );
  }

  return (
    <section className="mt-10" aria-labelledby="da-sua-equipe">
      <SectionHead
        id="da-sua-equipe"
        label="Da sua equipe"
        action={
          <Link href="/app/feed" className={LINK}>
            Ver feed
          </Link>
        }
      />
      {strip.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Ninguém da sua equipe treinou nos últimos 7 dias.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {strip.items.map((item) => (
            <TeamActivityRow
              key={item.id}
              activityId={item.id}
              name={item.user.name}
              image={item.user.image}
              workoutName={item.workoutName}
              timeLabel={timeAgo(item.createdAt, now)}
              fgCount={item.fgCount}
              hasGivenFg={item.hasGivenFg}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** "agora", "há 25 min", "há 3 h" today; "ontem", "há 3 dias" before (São Paulo calendar). */
function timeAgo(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (spDaysBetween(date, now) === 0) {
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    return `há ${Math.floor(minutes / 60)} h`;
  }
  return formatSpDaysAgo(date, now);
}

/** "Agora não": the invite steps aside for 30 days, on every device. */
async function dismissTeamInvite(): Promise<ActionResult> {
  "use server";
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  try {
    await prisma.userDismissal.upsert({
      where: { userId_key: { userId: user.id, key: INVITE_DISMISSAL } },
      create: { userId: user.id, key: INVITE_DISMISSAL },
      update: { createdAt: new Date() },
    });
  } catch (err) {
    console.error("dismissTeamInvite failed", err);
    return { ok: false, error: "Não foi possível fechar agora. Tente de novo." };
  }
  revalidatePath("/app/today");
  return { ok: true };
}
