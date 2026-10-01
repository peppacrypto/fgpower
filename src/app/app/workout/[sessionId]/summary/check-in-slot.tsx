import { prisma } from "@/lib/db";
import { getWeighInOnOrBefore } from "@/lib/data/body-metrics";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { wallClock } from "@/lib/training/week";
import { CheckInCard, CheckInLine, type CheckInValues } from "./check-in-card";

/**
 * The post-workout check-in on the summary (W-127, owned by C5), between the
 * masthead and "Quem vê". An async server component that loads the session's
 * check-in fields itself (summary-data stays the sharing cluster's), then
 * renders the client card; nothing for someone else's session.
 * `correctableUntil` is the summary's own correction deadline: while it runs
 * the check-in can be answered or edited; after it, an answered one is a
 * read-only line and an unanswered one is nothing.
 */
export async function CheckInSlot({
  userId,
  sessionId,
  correctableUntil,
}: {
  userId: string;
  sessionId: string;
  correctableUntil: Date | null;
}) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId, status: "COMPLETED" },
    select: {
      finishedAt: true,
      sessionRpe: true,
      soreness: true,
      shortSleep: true,
      lingeringPain: true,
      highStress: true,
      bodyweightKg: true,
      notes: true,
      checkInAt: true,
    },
  });
  if (!session?.finishedAt) return null;
  const values: CheckInValues = {
    sessionRpe: session.sessionRpe,
    soreness: session.soreness,
    shortSleep: session.shortSleep,
    lingeringPain: session.lingeringPain,
    highStress: session.highStress,
    bodyweightKg: session.bodyweightKg,
    notes: session.notes,
  };
  const answered = session.checkInAt != null;
  if (!correctableUntil) {
    return answered ? <CheckInLine values={values} className="mt-5" /> : null;
  }

  // The weight field: "PESO HOJE", or "PESO EM 20/09" for a workout saved on its own earlier day.
  const day = dayNumberOf(session.finishedAt);
  const sameDay = day === dayNumberOf(new Date());
  const w = wallClock(session.finishedAt);
  const weightLabel = sameDay ? "Peso hoje" : `Peso em ${String(w.day).padStart(2, "0")}/${String(w.month).padStart(2, "0")}`;
  const last = await getWeighInOnOrBefore(userId, day);

  return (
    <CheckInCard
      sessionId={sessionId}
      initial={values}
      answered={answered}
      weightLabel={weightLabel}
      lastKg={last?.value ?? null}
      className="mt-5"
    />
  );
}
