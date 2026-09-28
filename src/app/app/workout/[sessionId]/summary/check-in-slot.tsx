/**
 * The post-workout check-in on the summary (W-127, owned by C5), between the
 * masthead and "Quem vê". An async server component that loads the session's
 * check-in fields itself (summary-data stays the sharing cluster's), then
 * renders the client card; nothing for someone else's session.
 * `correctableUntil` is the summary's own correction deadline (null once the
 * 24 h passed: a read-only line, or nothing).
 *
 * Phase 0 stub with the final props: renders nothing yet.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C5 implements W-127)
export async function CheckInSlot(props: { userId: string; sessionId: string; correctableUntil: Date | null }) {
  return null;
}
