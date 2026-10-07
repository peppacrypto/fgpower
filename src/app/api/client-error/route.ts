import { createRateLimiter } from "@/lib/export/rate-limit";
import { clientIp } from "@/lib/email/login-send-limit";
import { captureClientError } from "@/lib/observability/sink";

export const dynamic = "force-dynamic";

/**
 * Client error beacon sink (A-048): the browser POSTs a tiny, PII-free report
 * (route, message, truncated stack, digest, build id) here from the global
 * handlers (src/instrumentation-client.ts) and the error boundary
 * (components/pwa/error-panel.tsx, app/global-error.tsx). Rate-limited per
 * client IP; the global /api body cap (src/proxy.ts, 256 KB) already bounds the
 * body. Always 204 (or 429) so a misbehaving client learns nothing.
 */
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
const MAX_STACK = 2000;

function field(value: unknown, max = 300): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

export async function POST(request: Request) {
  if (!limiter.hit(clientIp(request.headers)).ok) {
    return new Response(null, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    captureClientError({
      route: field(b.route) ?? "",
      source: field(b.source, 40) ?? "unknown",
      message: field(b.message) ?? "",
      stack: field(b.stack, MAX_STACK),
      digest: field(b.digest, 120),
      buildId: field(b.buildId, 120),
    });
  }
  return new Response(null, { status: 204 });
}
