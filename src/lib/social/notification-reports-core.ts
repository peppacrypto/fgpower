/**
 * Reports (decision 15): the reasons as the report sheet, the admin panel and
 * the admin e-mail name them, and the limits reportContent enforces. Pure
 * and client-safe (the sheet imports it; notification-reports.ts is the
 * server side).
 */

export const REPORT_REASONS = ["SPAM", "HARASSMENT", "INAPPROPRIATE_CONTENT", "FAKE_DATA", "OTHER"] as const;
export type ReportReasonCode = (typeof REPORT_REASONS)[number];

/** The sheet's radio labels (the long form of "Dados falsos" says what counts). */
export const REPORT_REASON_OPTION: Record<ReportReasonCode, string> = {
  SPAM: "Spam",
  HARASSMENT: "Assédio ou ofensa",
  INAPPROPRIATE_CONTENT: "Conteúdo impróprio",
  FAKE_DATA: "Dados falsos (cargas ou treinos inventados)",
  OTHER: "Outro",
};

/** Short labels for the admin panel and the e-mail. */
export const REPORT_REASON_LABEL: Record<ReportReasonCode, string> = {
  SPAM: "Spam",
  HARASSMENT: "Assédio ou ofensa",
  INAPPROPRIATE_CONTENT: "Conteúdo impróprio",
  FAKE_DATA: "Dados falsos",
  OTHER: "Outro",
};

export function isReportReason(value: unknown): value is ReportReasonCode {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

/**
 * The workout a report with no live post was about — its snapshot's, once
 * the owner deleted the post — or null: a report about the person, or an old
 * one that kept no snapshot. Reports about the same thing are settled
 * together (moderateReport) and counted together (the admin queue).
 */
export function goneWorkoutOf(snapshot: unknown): string | null {
  const s = snapshot && typeof snapshot === "object" ? (snapshot as { kind?: unknown; activityId?: unknown }) : null;
  return s?.kind === "activity" && typeof s.activityId === "string" ? s.activityId : null;
}

/** What the sheet lets the reporter type. */
export const REPORT_DETAILS_MAX = 500;
/** What the server keeps (a longer paste is cut, never refused). */
export const REPORT_DETAILS_STORED_MAX = 1000;
/** Reports one person may send in 24 h. */
export const REPORTS_PER_DAY = 10;
