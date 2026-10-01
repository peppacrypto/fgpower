import { expect, type Page } from "@playwright/test";
import { readOutbox, type OutboxMessage } from "./fixtures";

/**
 * Sign-in by e-mail (W-065) through the dev e-mail transport: the login
 * form asks for a code, /api/test/outbox hands back the e-mail it logged.
 * Addresses must be unique per test: better-auth ties codes to the address,
 * and an address first made through /api/test/login loses its password
 * account on its first e-mail proof (revokeUnprovenAccountAccess).
 */

export function uniqueAddress(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fgpower.dev`;
}

/**
 * The 6-digit code in a login e-mail, from its link (the dev transport keeps
 * the body; the log's subject never holds the code).
 */
export function codeFrom(message: OutboxMessage): string {
  const code = message.devBody?.match(/\/login\/link#\S*?\bc=(\d{6})/)?.[1];
  if (!code) throw new Error(`No code in the e-mail to ${message.subject}`);
  return code;
}

/**
 * The e-mail's link as a path on the server under test. Its origin is
 * NEXT_PUBLIC_APP_URL (another port in dev), so keep the path and fragment.
 */
export function linkFrom(message: OutboxMessage): string {
  const url = message.devBody?.match(/https?:\/\/\S+\/login\/link#\S+/)?.[0];
  if (!url) throw new Error("No sign-in link in the e-mail");
  const u = new URL(url);
  return `${u.pathname}${u.hash}`;
}

/** On /login: types the address, asks for the e-mail, and returns it once logged. */
export async function requestLoginEmail(page: Page, email: string): Promise<OutboxMessage> {
  const before = new Date(Date.now() - 1000);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByText("Verifique seu e-mail")).toBeVisible();
  return readOutbox(page, email, { kind: "LOGIN_CODE", after: before });
}
