/**
 * What counts as a deload week — the one rule for every reader (the streak,
 * Today, the reminders, week-complete notifications, progress charts): the
 * program's own guidance says so for that program week (a planned deload,
 * week-guidance isDeloadGuidance), OR the user applied a deload to that
 * calendar week ("Aplicar deload", ProgramEnrollment.deloadMondays). Never
 * read deloadMondays on its own. Pure.
 */

/** Whether the user turned this São Paulo week (its Monday day number) into a deload. */
export function isAppliedDeload(deloadMondays: readonly number[] | null | undefined, mondayNo: number): boolean {
  return deloadMondays?.includes(mondayNo) ?? false;
}

/** Planned (the program week's guidance) or applied (this calendar week) deload. */
export function effectiveDeload(
  guidanceDeload: boolean | null | undefined,
  deloadMondays: readonly number[] | null | undefined,
  mondayNo: number,
): boolean {
  return guidanceDeload === true || isAppliedDeload(deloadMondays, mondayNo);
}
