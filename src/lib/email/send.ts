import "server-only";
import { prisma } from "@/lib/db";
import { emailFrom, emailReplyTo, emailTransport } from "./config";

/**
 * Sends one e-mail through the configured transport (config.ts) and logs it
 * in EmailMessage — the per-address and daily budgets, the admin panel and
 * /api/test/outbox read that log. No SDK: Resend's REST API over fetch.
 * Never throws: a failed send is `{ ok: false }` and a FAILED row.
 */

export type EmailKind = "LOGIN_CODE" | "WEEKLY_DIGEST" | "ADMIN_REPORT";

export interface EmailMessageInput {
  /** One address. Several recipients (admin alerts) are several calls. */
  to: string;
  subject: string;
  html: string;
  /** The plain-text version (layout.ts renderEmail returns both). */
  text: string;
  kind: EmailKind;
  /** The account it is about, when there is one (the log is deleted with it). */
  userId?: string | null;
  /** Extra headers, e.g. List-Unsubscribe for the digest. */
  headers?: Record<string, string>;
  /** Resend drops a repeat with the same key within 24 h (e.g. `digest:<user>:<monday>`). */
  idempotencyKey?: string;
  /**
   * What the log keeps as the subject when the real one carries a secret (the
   * sign-in code): EmailMessage rows live 30 days and must hold no credential.
   */
  logSubject?: string;
}

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export async function sendEmail(m: EmailMessageInput): Promise<SendEmailResult> {
  const to = m.to.trim().toLowerCase();
  const transport = emailTransport();
  if (transport === "off") return { ok: false, error: "EMAIL_OFF" };
  if (!to.includes("@")) return { ok: false, error: "INVALID_ADDRESS" };

  if (transport === "dev") {
    const id = `dev_${globalThis.crypto.randomUUID()}`;
    console.info("[email:dev]", m.kind, to, m.logSubject ?? m.subject);
    await log(m, to, { transport, status: "LOGGED", providerId: id, devBody: m.text });
    return { ok: true, id };
  }

  let result: SendEmailResult;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
        ...(m.idempotencyKey ? { "idempotency-key": m.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(emailReplyTo() ? { reply_to: emailReplyTo() } : {}),
        ...(m.headers ? { headers: m.headers } : {}),
        tags: [{ name: "kind", value: m.kind }],
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const body = await res.text();
    if (res.ok) {
      const id = parseId(body);
      result = id ? { ok: true, id } : { ok: false, error: "NO_ID" };
    } else {
      result = { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
  if (!result.ok) console.error("[email] send failed", m.kind, result.error);
  await log(m, to, {
    transport,
    status: result.ok ? "SENT" : "FAILED",
    providerId: result.ok ? result.id : null,
    error: result.ok ? null : result.error,
  });
  return result;
}

function parseId(body: string): string | null {
  try {
    const id = (JSON.parse(body) as { id?: unknown }).id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

async function log(
  m: EmailMessageInput,
  to: string,
  row: { transport: string; status: "SENT" | "FAILED" | "LOGGED"; providerId?: string | null; error?: string | null; devBody?: string },
) {
  try {
    await prisma.emailMessage.create({
      data: {
        userId: m.userId ?? null,
        toEmail: to,
        kind: m.kind,
        subject: (m.logSubject ?? m.subject).slice(0, 300),
        transport: row.transport,
        status: row.status,
        providerId: row.providerId ?? null,
        error: row.error ?? null,
        devBody: row.devBody ?? null,
      },
    });
  } catch (err) {
    // The e-mail went (or not) either way; a lost log row must not turn into a failed send.
    console.error("[email] log write failed", err);
  }
}
