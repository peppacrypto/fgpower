import "dotenv/config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { POLICY_VERSION } from "@/lib/legal/policy";

/**
 * Policy re-acknowledge (A-054) against the real local Postgres. acknowledgePolicy
 * records that the signed-in user accepted the current POLICY_VERSION (idempotent),
 * and an expired session saves nothing. The Today notice is shown only when the
 * stored acknowledgedPolicyVersion trails POLICY_VERSION — the exact gate the
 * Today masthead computes and PolicyUpdateNotice honours.
 */

const RUN_ID = `pol-${Date.now()}`;
let current: { id: string } | null = null;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return current;
  },
}));

const { acknowledgePolicy } = await import("./policy");
const { PolicyUpdateNotice } = await import("@/app/app/today/policy-notice");

const userIds: string[] = [];

async function makeUser(label: string, acknowledgedPolicyVersion: string | null = null) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, username: `${label}_${Date.now().toString(36)}`.slice(0, 30) },
  });
  await prisma.profile.create({ data: { userId: id, displayName: label, onboardingCompletedAt: new Date(), acknowledgedPolicyVersion } });
  userIds.push(id);
  return { id };
}

const ackVersionOf = async (userId: string) =>
  (await prisma.profile.findUniqueOrThrow({ where: { userId }, select: { acknowledgedPolicyVersion: true } })).acknowledgedPolicyVersion;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("acknowledgePolicy", () => {
  it("records the current version and is idempotent", async () => {
    const user = await makeUser("acker", null);
    current = { id: user.id };

    expect(await acknowledgePolicy()).toEqual({ ok: true });
    expect(await ackVersionOf(user.id)).toBe(POLICY_VERSION);

    // A second call is a no-op write, still ok.
    expect(await acknowledgePolicy()).toEqual({ ok: true });
    expect(await ackVersionOf(user.id)).toBe(POLICY_VERSION);
  });

  it("saves nothing for an expired session", async () => {
    const user = await makeUser("expired", "2026-09");
    current = null;
    expect(await acknowledgePolicy()).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    // Untouched.
    expect(await ackVersionOf(user.id)).toBe("2026-09");
  });
});

describe("the Today re-acknowledge notice is shown only when the stored version trails", () => {
  // The exact staleness gate the Today masthead computes:
  // stale = profile != null && profile.acknowledgedPolicyVersion !== POLICY_VERSION
  const isStale = (p: { acknowledgedPolicyVersion: string | null } | null) =>
    p != null && p.acknowledgedPolicyVersion !== POLICY_VERSION;

  it("is not stale for a freshly-acknowledged profile, stale for a null or trailing one", async () => {
    const fresh = await makeUser("fresh", POLICY_VERSION);
    const old = await makeUser("old", "2026-09");
    const never = await makeUser("never", null);

    const load = (id: string) => prisma.profile.findUnique({ where: { userId: id }, select: { acknowledgedPolicyVersion: true } });
    expect(isStale(await load(fresh.id))).toBe(false);
    expect(isStale(await load(old.id))).toBe(true);
    expect(isStale(await load(never.id))).toBe(true);
    // A user with no profile row never sees it.
    expect(isStale(null)).toBe(false);
  });

  it("PolicyUpdateNotice renders nothing when not stale, and the notice when stale", () => {
    expect(renderToStaticMarkup(createElement(PolicyUpdateNotice, { stale: false }))).toBe("");
    const shown = renderToStaticMarkup(createElement(PolicyUpdateNotice, { stale: true }));
    expect(shown).toContain("Atualizamos a política");
    expect(shown).toContain("/privacy");
  });
});
