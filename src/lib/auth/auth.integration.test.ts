import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { auth, isAppAuthRoute } from "./auth";

/**
 * better-auth serves some fifty routes; the app calls a handful (auth.ts
 * APP_AUTH_ROUTES). Through the real handler, against the local Postgres:
 * every other route, the admin plugin's included, answers a bare 404 to a
 * signed-in user (to an admin, for the plugin's) and changes nothing. Above
 * all /update-user, which stored any image URL: an IP-logging pixel every
 * viewer's browser fetched. The app's own routes keep working.
 */

const RUN_ID = `s4auth-${Date.now()}`;
const PASSWORD = "s4-test-password-not-real-123!";
const ORIGIN = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
const TRACKER = "http://127.0.0.1:9/s4-tracker.png?who=viewer";

type Endpoint = ((...args: never[]) => unknown) & {
  path?: string;
  options?: { method?: string | string[]; metadata?: { SERVER_ONLY?: boolean } };
};

/** Every route better-auth answers over HTTP, as [method, path pattern]. */
function servedRoutes(): [string, string][] {
  return (Object.values(auth.api) as Endpoint[]).flatMap((endpoint) => {
    if (!endpoint.path || endpoint.options?.metadata?.SERVER_ONLY) return [];
    const methods = [endpoint.options?.method ?? "GET"].flat();
    return methods.map((method): [string, string] => [method, endpoint.path!]);
  });
}

function cookieOf(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** A request to /api/auth<path> from the app's own origin, as the browser would send it. */
function call(method: string, path: string, cookie: string, body?: unknown): Promise<Response> {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method,
      headers: { cookie, origin: ORIGIN, ...(method === "GET" ? {} : { "content-type": "application/json" }) },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    }),
  );
}

/** Refused by the app's allow-list: a bare 404, before the route itself reads anything. */
async function expectRefused(res: Response, what: string) {
  expect(res.status, what).toBe(404);
  expect(await res.text(), what).toBe("");
}

async function signUp(label: string) {
  const email = `${RUN_ID}-${label}@fgpower.dev`;
  const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: `S4 ${label}` }, asResponse: true });
  expect(res.ok).toBe(true);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { id: user.id, email, cookie: cookieOf(res) };
}

async function signIn(email: string) {
  const res = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(res.ok).toBe(true);
  return cookieOf(res);
}

const sessionUserId = async (cookie: string) =>
  ((await (await call("GET", "/get-session?disableCookieCache=true", cookie)).json()) as { user?: { id: string } } | null)?.user
    ?.id ?? null;

let member: Awaited<ReturnType<typeof signUp>>;

beforeAll(async () => {
  vi.stubEnv("EMAIL_TRANSPORT", "dev");
  member = await signUp("member");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await prisma.$disconnect();
});

describe("better-auth's routes", () => {
  it("the app's own routes are the allow-list; the password pair exists only outside production", () => {
    for (const path of ["/get-session", "/sign-in/social", "/callback/:id", "/sign-out", "/delete-user"]) {
      expect(isAppAuthRoute(path, true), path).toBe(true);
    }
    expect(isAppAuthRoute("/email-otp/send-verification-otp", true)).toBe(true);
    expect(isAppAuthRoute("/sign-in/email-otp", true)).toBe(true);
    expect(isAppAuthRoute("/sign-in/email", false)).toBe(true);
    expect(isAppAuthRoute("/sign-up/email", false)).toBe(true);
    for (const path of ["/sign-in/email", "/sign-up/email", "/update-user", "/admin/set-role", "/callback/google", undefined]) {
      expect(isAppAuthRoute(path, true), String(path)).toBe(false);
    }
    // Every allow-listed route is one better-auth still serves (a rename would leave a dead entry).
    const served = new Set(servedRoutes().map(([, path]) => path));
    const allowed = ["/get-session", "/sign-in/social", "/callback/:id", "/sign-out", "/delete-user", "/ok", "/error"];
    for (const path of [...allowed, "/email-otp/send-verification-otp", "/sign-in/email-otp", "/sign-in/email", "/sign-up/email"]) {
      expect(served.has(path), path).toBe(true);
    }
  });

  it("/update-user is gone: no image URL, no name, the row as it was", async () => {
    await expectRefused(await call("POST", "/update-user", member.cookie, { image: TRACKER }), "image");
    await expectRefused(await call("POST", "/update-user", member.cookie, { name: "X".repeat(400) }), "name");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id }, select: { image: true, name: true } });
    expect(row).toEqual({ image: null, name: "S4 member" });
  });

  it("every route the app doesn't call answers 404 to a signed-in user", async () => {
    const closed = servedRoutes().filter(([, path]) => !isAppAuthRoute(path));
    // The account-changing ones this is about are among them (a better-auth upgrade renaming them would show here).
    for (const path of ["/update-user", "/change-email", "/change-password", "/list-sessions", "/revoke-sessions", "/admin/set-role"]) {
      expect(closed.some(([, p]) => p === path), path).toBe(true);
    }
    expect(closed.length).toBeGreaterThan(30);
    for (const [method, path] of closed) {
      const url = path.replace(/:[a-zA-Z]+/g, "x");
      await expectRefused(await call(method, url, member.cookie, {}), `${method} ${path}`);
    }
  });

  it("nothing changes behind the app's back: sessions, password, linked accounts", async () => {
    const other = await signIn(member.email); // a second device
    await expectRefused(await call("POST", "/revoke-sessions", member.cookie), "revoke-sessions");
    await expectRefused(await call("POST", "/revoke-other-sessions", member.cookie), "revoke-other-sessions");
    await expectRefused(await call("POST", "/change-password", member.cookie, { currentPassword: PASSWORD, newPassword: "another-password-123!" }), "change-password");
    await expectRefused(await call("POST", "/unlink-account", member.cookie, { providerId: "credential" }), "unlink-account");
    await expectRefused(await call("GET", "/list-sessions", member.cookie), "list-sessions (session tokens)");
    expect(await sessionUserId(member.cookie)).toBe(member.id);
    expect(await sessionUserId(other)).toBe(member.id);
    expect(await prisma.account.count({ where: { userId: member.id } })).toBe(1);
    await signIn(member.email); // the password is the same
  });

  it("the admin plugin's routes are gone for an admin too: roles, profiles and impersonation go through the app's own actions", async () => {
    const admin = await signUp("admin");
    await prisma.user.update({ where: { id: admin.id }, data: { role: "admin" } });
    const cookie = await signIn(admin.email); // a session that carries the role
    const set = { userId: member.id };
    await expectRefused(await call("POST", "/admin/set-role", cookie, { ...set, role: "admin" }), "set-role");
    await expectRefused(await call("POST", "/admin/update-user", cookie, { ...set, data: { image: TRACKER } }), "update-user");
    await expectRefused(await call("POST", "/admin/impersonate-user", cookie, set), "impersonate-user");
    await expectRefused(await call("POST", "/admin/ban-user", cookie, set), "ban-user");
    await expectRefused(await call("GET", "/admin/list-users", cookie), "list-users");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id }, select: { role: true, image: true, banned: true } });
    expect(row).toEqual({ role: "user", image: null, banned: false });
  });

  it("the app's own routes still answer: the session, Google, the e-mail code, sign-out and account deletion", async () => {
    expect(await sessionUserId(member.cookie)).toBe(member.id);
    expect((await call("GET", "/ok", "")).status).toBe(200);
    // Reached past the allow-list: each answers in its own words (no Google app locally, a refused code type…).
    const google = await call("POST", "/sign-in/social", "", { provider: "google", callbackURL: "/app/today" });
    expect(google.status === 200 || (await google.clone().text()) !== "", "sign-in/social reached").toBe(true);
    const code = await call("POST", "/email-otp/send-verification-otp", "", { email: `${RUN_ID}-x@fgpower.dev`, type: "email-verification" });
    expect(code.status).toBe(400);
    expect(await code.json()).toMatchObject({ message: "Only sign-in codes are offered" });

    const leaving = await signUp("leaving");
    const signedOut = await call("POST", "/sign-out", leaving.cookie);
    expect(signedOut.status).toBe(200);
    expect(await sessionUserId(leaving.cookie)).toBeNull();

    const deleting = await signUp("deleting");
    const deleted = await call("POST", "/delete-user", deleting.cookie, {});
    expect(deleted.status).toBe(200);
    expect(await prisma.user.count({ where: { id: deleting.id } })).toBe(0);
  });
});
