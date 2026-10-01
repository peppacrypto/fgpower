import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/require-user";
import { isAdminUser } from "@/lib/auth/roles";
import { countUnread } from "@/lib/social/notifications";
import { countOpenReports } from "@/lib/social/notification-reports";

/**
 * The unread-notifications count the app shell's pip shows (UnreadProvider
 * re-reads it on navigation and when the app comes back to the front), plus
 * the open reports for admins. `{ unread }` / `{ unread, openReports }`;
 * 401 when signed out. Never cached.
 */
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getCurrentSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const admin = isAdminUser(session.user);
  const [unread, openReports] = await Promise.all([countUnread(session.user.id), admin ? countOpenReports() : null]);
  return NextResponse.json(openReports === null ? { unread } : { unread, openReports }, { headers: NO_STORE });
}
