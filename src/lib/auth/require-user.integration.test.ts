import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

/**
 * requireUser / requireAdmin / getCurrentSession against the real better-auth
 * and the local Postgres. better-auth's 5-minute cookie cache vouches for a
 * session it has seen; the session every check and page shares is read from
 * the database too, so a role taken away, a ban or a sign-out on another
 * device bite on the next request, not up to 5 minutes later — and /login
 * agrees with the app's pages (it once sent an ended session back to them: a
 * redirect loop). The database read writes no cookie (in a server action that
 * would re-render the page).
 */

const RUN_ID = `s4req-${Date.now()}`;
const PASSWORD = "s4-test-password-not-real-123!";

/** The request the checks see: its Cookie header and the page path the proxy passes on. */
const request = vi.hoisted(() => ({ cookie: "", path: null as string | null }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: request.cookie, ...(request.path ? { "x-fg-path": request.path } : {}) }),
}));
class Redirected extends Error {
  constructor(public url: string) {
    super(`REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

const { getCurrentSession, requireAdmin, requireAdminOrThrow, requireUser, requireUserOrThrow } = await import("./require-user");
const { auth } = await import("./auth");
const { default: LoginPage } = await import("@/app/login/page");

function cookieOf(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function signUp(label: string) {
  const email = `${RUN_ID}-${label}@fgpower.dev`;
  const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: `S4 ${label}` }, asResponse: true });
  expect(res.ok).toBe(true);
  const { id } = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return { id, email, cookie: cookieOf(res) };
}

/** A new sign-in: its cookie cache carries the user as the database has them now (role included). */
async function signIn(email: string) {
  const res = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(res.ok).toBe(true);
  return cookieOf(res);
}

/** What better-auth's cookie cache alone says about this request's session. */
const cachedSession = () => auth.api.getSession({ headers: new Headers({ cookie: request.cookie }) });

/** What a check did: let `ok:<user id>` in, redirected, or threw. */
async function outcome(check: Promise<{ id: string }>): Promise<string> {
  try {
    return `ok:${(await check).id}`;
  } catch (err) {
    if (err instanceof Redirected) return `redirect:${err.url}`;
    return `throw:${(err as Error).message}`;
  }
}

/** What /login does with this request: shows its form, or sends a signed-in visitor on (`redirect:<url>`). */
async function loginPage(searchParams: Record<string, string>): Promise<string> {
  try {
    await LoginPage({ searchParams: Promise.resolve(searchParams) } as Parameters<typeof LoginPage>[0]);
    return "form";
  } catch (err) {
    if (err instanceof Redirected) return `redirect:${err.url}`;
    throw err;
  }
}

beforeEach(() => {
  request.cookie = "";
  request.path = null;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await prisma.$disconnect();
});

describe("the admin gate reads the role from the database", () => {
  it("a role taken away stops working on the next request, though the cookie cache still says admin", async () => {
    const who = await signUp("demoted");
    await prisma.user.update({ where: { id: who.id }, data: { role: "admin" } });
    request.cookie = await signIn(who.email);
    expect(await outcome(requireAdmin())).toBe(`ok:${who.id}`);
    expect(await outcome(requireAdminOrThrow())).toBe(`ok:${who.id}`);

    await prisma.user.update({ where: { id: who.id }, data: { role: "user" } });
    expect((await cachedSession())?.user.role, "the cache would vouch for 5 more minutes").toBe("admin");
    expect((await getCurrentSession())?.user.role, "what every page and route handler sees").toBe("user");
    expect(await outcome(requireAdmin())).toBe("redirect:/app/today");
    expect(await outcome(requireAdminOrThrow())).toBe("throw:FORBIDDEN");
    expect(await outcome(requireUser()), "still a member").toBe(`ok:${who.id}`);
  });

  it("a role granted works at once", async () => {
    const who = await signUp("promoted");
    request.cookie = who.cookie;
    expect(await outcome(requireAdminOrThrow())).toBe("throw:FORBIDDEN");
    await prisma.user.update({ where: { id: who.id }, data: { role: "admin" } });
    expect(await outcome(requireAdminOrThrow())).toBe(`ok:${who.id}`);
  });
});

describe("a session that ended on the server is refused at once", () => {
  it("a ban (its sessions ended, as moderateReport does) says the session expired, back to the same page", async () => {
    const who = await signUp("banned");
    request.cookie = who.cookie;
    request.path = "/app/feed";
    expect(await outcome(requireUser())).toBe(`ok:${who.id}`);

    await prisma.$transaction([
      prisma.user.update({ where: { id: who.id }, data: { banned: true, banReason: "teste" } }),
      prisma.session.deleteMany({ where: { userId: who.id } }),
    ]);
    expect((await cachedSession())?.user.id, "the cache would vouch for 5 more minutes").toBe(who.id);
    expect(await getCurrentSession()).toBeNull();
    expect(await outcome(requireUser())).toBe("redirect:/login?next=%2Fapp%2Ffeed&sessao=expirada");
    expect(await outcome(requireUserOrThrow())).toBe("throw:UNAUTHORIZED");
    expect(await outcome(requireAdminOrThrow())).toBe("throw:UNAUTHORIZED");
  });

  it("a banned account is refused even with a session left; lifting the ban lets it back in", async () => {
    const who = await signUp("banned-kept");
    request.cookie = who.cookie;
    await prisma.user.update({ where: { id: who.id }, data: { banned: true } });
    expect(await outcome(requireUserOrThrow())).toBe("throw:UNAUTHORIZED");
    expect(await getCurrentSession()).toBeNull();
    await prisma.user.update({ where: { id: who.id }, data: { banned: false } });
    expect(await outcome(requireUserOrThrow())).toBe(`ok:${who.id}`);
  });

  it("a sign-out on another device", async () => {
    const who = await signUp("elsewhere");
    request.cookie = who.cookie;
    await prisma.session.deleteMany({ where: { userId: who.id } });
    expect(await outcome(requireUserOrThrow())).toBe("throw:UNAUTHORIZED");
  });

  it("no session cookie at all is a plain sign-in, not 'expired'", async () => {
    request.path = "/app/programs";
    expect(await outcome(requireUser())).toBe("redirect:/login?next=%2Fapp%2Fprograms");
    expect(await outcome(requireUserOrThrow())).toBe("throw:UNAUTHORIZED");
  });
});

describe("/login agrees with the app's pages", () => {
  const expired = { next: "/app/today", sessao: "expirada" };

  it("a live session still goes straight on to the app", async () => {
    const who = await signUp("login-live");
    request.cookie = who.cookie;
    expect(await loginPage(expired)).toBe("redirect:/app/today");
  });

  it.each([
    {
      how: "sessions ended (a ban, an account deleted on another device)",
      end: (id: string) => prisma.session.deleteMany({ where: { userId: id } }),
    },
    { how: "banned with a session left", end: (id: string) => prisma.user.update({ where: { id }, data: { banned: true } }) },
  ])("$how: the login form, not back to the app it came from (a redirect loop)", async ({ end }) => {
    const who = await signUp(`login-${Math.random().toString(36).slice(2, 8)}`);
    request.cookie = who.cookie;
    request.path = "/app/today";
    await end(who.id);
    expect(await cachedSession(), "the cache still vouches for it").not.toBeNull();
    expect(await outcome(requireUser())).toBe("redirect:/login?next=%2Fapp%2Ftoday&sessao=expirada");
    expect(await loginPage(expired)).toBe("form");
  });
});

describe("the database read", () => {
  it("writes no cookie when the session is fine, unlike a cache-less read that renews the cache cookie", async () => {
    const who = await signUp("cookies");
    const headers = new Headers({ cookie: who.cookie });
    const live = await auth.api.getSession({ headers, query: { disableCookieCache: true, disableRefresh: true }, returnHeaders: true });
    expect(live.response?.user.id).toBe(who.id);
    expect(live.headers?.get("set-cookie") ?? null).toBeNull();
    const renewing = await auth.api.getSession({ headers, query: { disableCookieCache: true }, returnHeaders: true });
    expect(renewing.headers?.get("set-cookie") ?? "").toContain("session_data");
  });
});
