/**
 * Which program day a workout session belongs to. Sessions link to their day
 * by id, but editing a program recreates its days (the link becomes null), so
 * fall back to the day's name — which follows a day when days are moved — and
 * only then to its position.
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
  const byName = days.filter((d) => d.name === session.name);
  if (byName.length === 1) return byName[0];
  if (session.programDayIndex == null) return undefined;
  const byIndex = days.find((d) => d.dayIndex === session.programDayIndex);
  // A same-named day elsewhere means the index now points at a different day.
  return byIndex && (byName.length === 0 || byName.includes(byIndex)) ? byIndex : undefined;
}
