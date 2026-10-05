import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PATH_HEADER } from "@/lib/auth/path-header";

/**
 * Global /api request-body cap (A-045). Legitimate /api posts are small JSON
 * (the set outbox, autosave rows, auth credentials, webhook events); 256 KB is
 * far above any of them. Enforced in the proxy so an oversized body is rejected
 * before any handler reads or JSON-parses it and before the optimistic session
 * check. The Node proxy still buffers the incoming body, but that buffer is
 * hard-capped by experimental.proxyClientMaxBodySize (next.config.ts, 1 MB), so
 * an anonymous client can neither reach a handler with, nor exhaust memory on,
 * a multi-megabyte payload.
 */
const MAX_API_BODY_BYTES = 256 * 1024;

/** Methods that carry a request body and therefore get the /api body cap. */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Optimistic route guard (Next.js 16 proxy — formerly `middleware.ts`).
 *
 * This only checks whether a session cookie is PRESENT, not whether it is
 * valid. Real authorization happens in every protected page/server
 * action/route handler via `auth.api.getSession()`. See
 * src/lib/auth/require-user.ts.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Global /api body cap (A-045): a body-bearing /api request must declare a
  // Content-Length (411 otherwise) and stay at or under MAX_API_BODY_BYTES
  // (413 otherwise). This runs before getSessionCookie and before any handler
  // reads or JSON-parses the body; the proxy's own in-memory buffer is bounded
  // by experimental.proxyClientMaxBodySize (next.config.ts), so an oversized
  // anonymous payload reaches no handler and cannot exhaust memory.
  if (pathname.startsWith("/api") && BODY_METHODS.has(request.method)) {
    const header = request.headers.get("content-length");
    const length = header === null ? NaN : Number(header);
    if (!Number.isFinite(length) || length < 0) {
      return NextResponse.json({ error: "length required" }, { status: 411 });
    }
    if (length > MAX_API_BODY_BYTES) {
      return NextResponse.json({ error: "payload too large" }, { status: 413 });
    }
  }

  const hasSession = getSessionCookie(request);
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
  matcher: ["/app/:path*", "/api/:path*"],
};
