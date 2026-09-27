import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PATH_HEADER } from "@/lib/auth/path-header";

/**
 * Optimistic route guard (Next.js 16 proxy — formerly `middleware.ts`).
 *
 * This only checks whether a session cookie is PRESENT, not whether it is
 * valid. Real authorization happens in every protected page/server
 * action/route handler via `auth.api.getSession()`. See
 * src/lib/auth/require-user.ts.
 */
export async function proxy(request: NextRequest) {
  const hasSession = getSessionCookie(request);

  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/app");

  // A server action is a POST from a page already on screen: redirecting it to
  // the login page would hand the client HTML it can't use. Let it through —
  // the action itself answers "session expired" and the page offers to sign in.
  if (isProtected && !hasSession && !request.headers.has("next-action")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Tell the page where it is, so a session that ended mid-visit can send the
  // user back here after signing in again (requireUser).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATH_HEADER, pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/app/:path*"],
};
