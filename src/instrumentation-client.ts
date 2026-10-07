import { reportClientError } from "@/lib/observability/client-beacon";

/**
 * Client-side instrumentation (A-048): wire the global error handlers before
 * hydration so an uncaught exception or an unhandled promise rejection is
 * beaconed to /api/client-error. Kept tiny per Next's guidance for this file,
 * and wrapped so a setup failure never blocks page load.
 */
try {
  window.addEventListener("error", (event) => {
    // Resource-load failures (img/script 404) carry no Error — skip them.
    if (!event.error) return;
    reportClientError({
      source: "window",
      message: event.error instanceof Error ? event.error.message : event.message || "client error",
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    reportClientError({
      source: "unhandledrejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
} catch {
  // Never let instrumentation setup break page load.
}
