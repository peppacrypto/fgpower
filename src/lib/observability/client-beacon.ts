/**
 * Client error beacon (A-048): POSTs a tiny, PII-free report to
 * /api/client-error. Capped per session so a render loop can't flood the sink,
 * and fire-and-forget so reporting never blocks or breaks the page. No user text
 * and no id beyond the build sha is ever sent.
 */

const MAX_REPORTS_PER_SESSION = 10;
const MAX_MESSAGE = 300;
const MAX_STACK = 2000;
let sent = 0;

// Inlined at build time; "unknown" until NEXT_PUBLIC_BUILD_SHA is set at deploy.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown";

export interface ClientErrorReport {
  source: "window" | "unhandledrejection" | "boundary";
  message: string;
  stack?: string;
  digest?: string;
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function reportClientError(report: ClientErrorReport): void {
  try {
    if (typeof window === "undefined" || sent >= MAX_REPORTS_PER_SESSION) return;
    sent += 1;
    const body = JSON.stringify({
      route: window.location?.pathname ?? "",
      source: report.source,
      message: clip(report.message || "client error", MAX_MESSAGE),
      stack: report.stack ? clip(report.stack, MAX_STACK) : undefined,
      digest: report.digest,
      buildId: BUILD_ID,
    });
    // keepalive so the POST survives a navigation/unload; sets Content-Length,
    // which the /api proxy requires (src/proxy.ts), and stays under the 256 KB cap.
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      // Reporting is best-effort; a failed beacon must never surface.
    });
  } catch {
    // Never let reporting break the app.
  }
}
