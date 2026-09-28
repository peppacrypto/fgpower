"use client";

/**
 * Reporting a workout or a person (decision 15, W-141 C). Owned by the social
 * inbox cluster (C1): an ActionSheet with the reasons (Spam · Assédio ou
 * ofensa · Conteúdo impróprio · Dados falsos · Outro), optional details, then
 * "Denúncia enviada…" and "Bloquear @x também". It calls
 * reportContent({ activityId | reportedUserId, reason, details, shareToken }).
 *
 * Phase 0 stubs with the final props: they render nothing yet. Rendered by
 * the activity page and /u (C2) and the shared-workout page /t (C3).
 */

export type ReportTarget =
  | { kind: "activity"; activityId: string; author: { id: string; username: string | null; name: string } }
  | { kind: "user"; user: { id: string; username: string | null; name: string } };

export interface ReportSheetProps {
  target: ReportTarget;
  /**
   * A viewer who only holds the share link (/t/<token>) reports with it:
   * reportContent accepts `canViewActivity || activity.shareToken === token`.
   */
  shareToken?: string;
  /** Offer "Bloquear @x também" after sending (false when already blocked). */
  canBlock?: boolean;
  onClose: () => void;
}

/** The sheet itself, controlled by its parent (e.g. the /u "⋯" menu). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements W-141)
export function ReportSheet(props: ReportSheetProps) {
  return null;
}

/** A "Denunciar" button that opens the sheet (activity page, /t). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements W-141)
export function ReportButton(props: Omit<ReportSheetProps, "onClose"> & { label?: string; className?: string }) {
  return null;
}
