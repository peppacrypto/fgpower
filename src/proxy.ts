import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

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

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
