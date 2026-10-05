/**
 * Which program day a workout session belongs to. Sessions link to their day
 * by id; the builder keeps day ids across edits and reorders (A-001), so a live
 * link is the whole answer. Only a deleted day leaves the link null (SET NULL),
 * or a session predates kept ids — and then the day's NAME, which follows a day
 * when days are moved, is the fallback. The ordinal is NOT a fallback: a deleted
 * day's position is now a DIFFERENT day's, and crediting the session to it would
 * mark an untrained day done and hijack its "Iniciar" (A-023). `programDayIndex`
 * is kept on the type (callers still select it) but no longer used to match.
 */
export interface MatchableDay {
  id: string;
  dayIndex: number;
  name: string;
}

export interface MatchableSession {
  programDayId: string | null;
  programDayIndex: number | null;
  name: string;
}

export function resolveSessionDay<D extends MatchableDay>(session: MatchableSession, days: D[]): D | undefined {
  if (session.programDayId) {
    const byId = days.find((d) => d.id === session.programDayId);
    if (byId) return byId;
  }
  // The link is gone (the day was deleted) or the session predates kept ids:
  // follow the day's NAME only. Never fall back to the ordinal — a lost link
  // means the day was deleted and its old position is held by another day; an
  // unmatched session counts under its name key in the streak (A-023).
  const byName = days.filter((d) => d.name === session.name);
  return byName.length === 1 ? byName[0] : undefined;
}
