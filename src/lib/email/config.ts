import "server-only";

/**
 * Which e-mail transport this process uses:
 * - "resend": RESEND_API_KEY and EMAIL_FROM are set (the Resend REST API);
 * - "dev": outside production without them — nothing leaves the machine; the
 *   message is logged and kept in EmailMessage.devBody (/api/test/outbox);
 * - "off": EMAIL_TRANSPORT=off, or production without Resend. Never "dev" in
 *   production: it would write login codes to the logs and the database.
 * Features built on e-mail (login by e-mail, the digest, admin alerts) hide
 * themselves while it is off — no dead buttons.
 */
export type EmailTransport = "resend" | "dev" | "off";

export function emailTransport(): EmailTransport {
  const forced = process.env.EMAIL_TRANSPORT?.trim().toLowerCase();
  if (forced === "off") return "off";
  const resend = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
  const production = process.env.NODE_ENV === "production";
  if (forced === "dev" && !production) return "dev";
  if (resend) return "resend";
  return production || forced === "resend" ? "off" : "dev";
}

export function emailEnabled(): boolean {
  return emailTransport() !== "off";
}

/** The sender, e.g. `FGPOWER <acesso@fgpower.monster>` (Resend: a verified domain). */
export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "FGPOWER <dev@fgpower.local>";
}

export function emailReplyTo(): string | null {
  return process.env.EMAIL_REPLY_TO?.trim() || null;
}
