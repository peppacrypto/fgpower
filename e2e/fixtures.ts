import { execSync } from "node:child_process";
import { devices, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Shared E2E helpers. Frozen for the Batch 5 clusters: add spec-specific
 * helpers in the spec (or a new helper file), not here.
 */

/**
 * Logs the browser context in as a fixed E2E test account via the dev-only
 * /api/test/login route (see src/app/api/test/login/route.ts). This never
 * exists in production — better-auth's emailAndPassword provider is
 * disabled there, and the route itself 404s.
 */
export async function loginAsTestUser(page: Page, email = "e2e@fgpower.dev", name = "E2E Test") {
  const response = await page.request.post("/api/test/login", { data: { email, name } });
  if (!response.ok()) {
    throw new Error(`Test login failed: ${response.status()} ${await response.text()}`);
  }
  // The session cookie must live like a real sign-in's (days), not like the
  // 5-minute cache cookie next to it — a short one logs long runs out halfway.
  const token = (await page.context().cookies()).find((c) => c.name.endsWith("better-auth.session_token"));
  if (!token || token.expires * 1000 < Date.now() + 24 * 60 * 60 * 1000) {
    throw new Error("Test login: the session cookie expires in less than a day");
  }
}

/** The phone the app is used on (Chromium engine): `test.use(IPHONE)` or `browser.newContext(IPHONE)`. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...IPHONE_13 } = devices["iPhone 13"];
export const IPHONE = IPHONE_13;

/**
 * Runs SQL against the LOCAL docker Postgres (container fgpower-postgres) and
 * returns psql's unaligned output ("a|b" rows, one per line). Stops at the
 * first error. Local databases only.
 */
export function sql(query: string): string {
  return execSync(`docker exec -i fgpower-postgres sh -c 'psql -U "$POSTGRES_USER" -d fgpower -At -v ON_ERROR_STOP=1'`, {
    encoding: "utf8",
    input: query,
  }).trim();
}

/** A SQL string literal (single quotes doubled). */
export function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The signed-in user's id (better-auth's session endpoint). */
export async function userIdOf(page: Page): Promise<string> {
  const res = await page.request.get("/api/auth/get-session");
  const body = await res.json();
  if (!body?.user?.id) throw new Error("userIdOf: not signed in");
  return body.user.id as string;
}

export interface TestUser {
  id: string;
  email: string;
  /** Their @handle (onboarding always gives one). */
  username: string;
  /** Display name. */
  name: string;
}

function uniqueAddress(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fgpower.dev`;
}

/**
 * A brand-new account in `page`'s browser context: signs in with a unique
 * address and walks the onboarding wizard with `name` (and `handle`, else the
 * suggested one). Lands on /app/today. Optional privacy settings are written
 * straight to the profile.
 */
export async function newOnboardedUser(
  page: Page,
  opts: {
    label: string;
    name?: string;
    handle?: string;
    isPublicAccount?: boolean;
    discoverable?: boolean;
    defaultWorkoutVisibility?: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
  },
): Promise<TestUser> {
  const email = uniqueAddress(opts.label);
  const name = opts.name ?? `Teste ${Math.random().toString(36).slice(2, 7)}`;
  await loginAsTestUser(page, email);
  await page.goto("/onboarding");
  await page.getByLabel("Nome de exibição").fill(name);
  if (opts.handle !== undefined) await page.getByLabel("Seu @usuário (opcional)").fill(opts.handle);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ver meu plano" }).click(),
  ]);
  const id = await userIdOf(page);
  const username = sql(`SELECT username FROM "user" WHERE id = ${sqlText(id)}`);
  setProfile(id, {
    isPublicAccount: opts.isPublicAccount,
    discoverable: opts.discoverable,
    defaultWorkoutVisibility: opts.defaultWorkoutVisibility,
  });
  return { id, email, username, name };
}

/**
 * A second (third…) person in their own browser context — iPhone 13 unless
 * `contextOptions` says otherwise — signed in and onboarded. Close the
 * context when done.
 */
export async function newUserContext(
  browser: Browser,
  opts: Parameters<typeof newOnboardedUser>[1] & { contextOptions?: Parameters<Browser["newContext"]>[0] },
): Promise<TestUser & { context: BrowserContext; page: Page }> {
  const context = await browser.newContext(opts.contextOptions ?? IPHONE);
  const page = await context.newPage();
  const user = await newOnboardedUser(page, opts);
  return { ...user, context, page };
}

/** Writes privacy fields straight to a profile (undefined fields are left alone). */
export function setProfile(
  userId: string,
  fields: {
    isPublicAccount?: boolean;
    discoverable?: boolean;
    defaultWorkoutVisibility?: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
    showLoadsPublicly?: boolean;
  },
) {
  const sets = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `"${k}" = ${typeof v === "boolean" ? v : sqlText(String(v))}`);
  if (sets.length === 0) return;
  sql(`UPDATE "Profile" SET ${sets.join(", ")} WHERE "userId" = ${sqlText(userId)}`);
}

/** `followerId` follows `targetId`, written straight to the DB (no request, no notification). */
export function follow(followerId: string, targetId: string) {
  sql(`INSERT INTO "Follow" ("followerId", "followingId") VALUES (${sqlText(followerId)}, ${sqlText(targetId)}) ON CONFLICT DO NOTHING`);
}

/**
 * Ends a user's sessions on the server, as another device's sign-out would:
 * their better-auth session rows are deleted, and `context`'s 5-minute
 * session cache cookie is dropped (it would vouch for the session a while
 * longer). The next action finds the session gone.
 */
export async function revokeSessions(userId: string, context: BrowserContext) {
  sql(`DELETE FROM "session" WHERE "userId" = ${sqlText(userId)}`);
  const keep = (await context.cookies()).filter((c) => c.name !== "better-auth.session_data");
  await context.clearCookies();
  await context.addCookies(keep);
}

export interface OutboxMessage {
  id: string;
  kind: string;
  subject: string;
  /** The plain-text body (dev transport). */
  devBody: string | null;
  status: string;
  createdAt: string;
}

/**
 * The newest e-mail the dev transport logged for `to` (GET /api/test/outbox),
 * waiting up to `timeoutMs` for one — newer than `after` when given (a resend).
 */
export async function readOutbox(
  page: Page,
  to: string,
  opts: { kind?: string; after?: Date; timeoutMs?: number } = {},
): Promise<OutboxMessage> {
  const deadline = Date.now() + (opts.timeoutMs ?? 10_000);
  const params = new URLSearchParams({ to });
  if (opts.kind) params.set("kind", opts.kind);
  for (;;) {
    const res = await page.request.get(`/api/test/outbox?${params}`);
    if (res.ok()) {
      const message = (await res.json()) as OutboxMessage;
      if (!opts.after || new Date(message.createdAt) > opts.after) return message;
    }
    if (Date.now() > deadline) throw new Error(`readOutbox: no e-mail for ${to}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
