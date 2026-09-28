/**
 * Today's "Da sua equipe" (W-139, owned by C2): the latest workouts of people
 * the user follows (7 days, FOLLOWERS/PUBLIC, not banned), with FG; following
 * nobody after the first finished workout, the "Treine com amigos" invite
 * (unless `allowInvite` is false: Today shows at most one optional prompt —
 * fatigue > weigh-in > team invite). An async server component that loads its
 * own data (lib/data/social getTeamStrip) and renders nothing when that fails,
 * so Today keeps working.
 *
 * Phase 0 stub with the final props: renders nothing yet.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C2 implements W-139)
export async function TeamStrip(props: { userId: string; now: Date; finishedWorkouts: number; allowInvite: boolean }) {
  return null;
}
