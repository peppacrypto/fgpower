import "server-only";
import { buildSha } from "@/lib/build-info";
import { emailTransport } from "@/lib/email/config";
import { pushTransport } from "@/lib/push/config";
import { reminderSchedulerEnabled } from "@/lib/reminders/scheduler";

/**
 * The internal observability sink (A-048). Today it only structured-logs to the
 * Next server's stdout/stderr — Railway captures these, and a crash still mails
 * the operator. Each `// SEAM (owner residue)` comment marks the single place an
 * external destination (Sentry for errors, an uptime/dead-man monitor for the
 * heartbeat) is wired in later; no DSN, account or credential is invented here.
 *
 * Nothing in this module logs request headers, cookies, bodies, user text, or
 * any id beyond the build sha: the payloads are deliberately tiny and PII-free.
 */

const MAX_MESSAGE = 300;
const MAX_STACK = 2000;

function clip(value: string | undefined, max: number): string | undefined {
  if (value == null) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

export interface ServerErrorEvent {
  message: string;
  digest?: string;
  stack?: string;
  path?: string;
  method?: string;
  routePath?: string;
  routeType?: string;
}

/** A server error Next captured (Server Component, Route Handler, action, proxy). */
export function captureServerError(event: ServerErrorEvent): void {
  const record = {
    kind: "server-error" as const,
    buildSha: buildSha(),
    message: clip(event.message, MAX_MESSAGE),
    digest: event.digest,
    path: event.path,
    method: event.method,
    routePath: event.routePath,
    routeType: event.routeType,
    stack: clip(event.stack, MAX_STACK),
  };
  // SEAM (owner residue): forward `record` to Sentry / an error tracker here.
  console.error("[observability]", JSON.stringify(record));
}

export interface ClientErrorEvent {
  route: string;
  source: string;
  message: string;
  stack?: string;
  digest?: string;
  buildId?: string;
}

/** A browser error beaconed from src/instrumentation-client.ts or an error boundary. */
export function captureClientError(event: ClientErrorEvent): void {
  const record = {
    kind: "client-error" as const,
    serverBuildSha: buildSha(),
    clientBuildId: event.buildId ?? "unknown",
    route: clip(event.route, MAX_MESSAGE),
    source: event.source,
    message: clip(event.message, MAX_MESSAGE),
    digest: event.digest,
    stack: clip(event.stack, MAX_STACK),
  };
  // SEAM (owner residue): forward `record` to Sentry / an error tracker here.
  console.error("[observability]", JSON.stringify(record));
}

/** A liveness ping. The reminder tick emits one per scheduler tick (dead-man). */
export function heartbeat(source: string, data: Record<string, unknown> = {}): void {
  const record = { kind: "heartbeat" as const, source, at: new Date().toISOString(), buildSha: buildSha(), ...data };
  // SEAM (owner residue): ping an uptime / dead-man monitor (e.g. a healthchecks.io URL) here.
  console.info("[observability]", JSON.stringify(record));
}

/** One line at boot: which features are live in this process. No secrets. */
export function logBootSummary(): void {
  const record = {
    kind: "boot" as const,
    buildSha: buildSha(),
    scheduler: reminderSchedulerEnabled() ? "on" : "off",
    email: emailTransport(),
    push: pushTransport(),
  };
  console.info("[observability] boot", JSON.stringify(record));
}
