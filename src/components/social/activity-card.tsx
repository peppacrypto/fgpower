import "server-only";
import { toCardSummary, type WorkoutActivitySummary } from "@/lib/social/activity-summary";
import { ActivityCardView } from "./activity-card-view";
import { milestoneStampOf } from "./milestone-stamp";
import { MilestoneStampCard } from "./milestone-stamp-card";

export interface ActivityCardData {
  id: string;
  sessionId: string | null;
  caption: string | null;
  createdAt: Date | string;
  fgCount: number;
  hasGivenFg: boolean;
  user: { name: string; username: string | null; image: string | null };
  /** The stored Activity.summary, as is: it is trimmed here, on the server. */
  summary: WorkoutActivitySummary;
  /** The activity's "Mostrar cargas"; when false, the volume is dropped too. */
  showDetailedLoads?: boolean;
  /**
   * Who sees it — pass it for the viewer's OWN workouts only: the card then
   * carries a "SEGUIDORES" chip that opens its "Quem vê" (W-144).
   */
  visibility?: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
}

/**
 * A workout in the feed / on a profile. A server component on purpose: the
 * stored summary can carry record weights and e1RMs the owner chose to hide
 * (summaries saved before those were stripped), and everything passed to the
 * client card ends up in the page payload — so only what the card shows
 * (toCardSummary) crosses over. A private milestone (the 10th workout, a
 * completed block: its summary's `kind`) is drawn as a stamp instead — no FG.
 */
export function ActivityCard({
  activity,
  ...rest
}: {
  activity: ActivityCardData;
  currentUsername?: string | null;
  /** Whether the viewer wrote this activity (preferred over the username match). */
  isOwn?: boolean;
  /** Set when the viewer is signed out: FG becomes a sign-in link that returns here. */
  signInReturnTo?: string;
  /** Explain FG under this card's heart (the viewer never gave one; W-147). */
  fgHint?: boolean;
}) {
  const { summary, showDetailedLoads, ...card } = activity;
  const stamp = milestoneStampOf(summary);
  if (stamp) {
    const isOwn = rest.isOwn ?? (rest.currentUsername != null && card.user.username === rest.currentUsername);
    return <MilestoneStampCard activityId={card.id} createdAt={card.createdAt} stamp={stamp} isOwn={isOwn} />;
  }
  return <ActivityCardView activity={{ ...card, summary: toCardSummary(summary, showDetailedLoads) }} {...rest} />;
}
