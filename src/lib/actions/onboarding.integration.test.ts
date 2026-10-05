import "dotenv/config";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/legal/policy";

/**
 * Onboarding captures the LGPD gates (A-049 age, A-008 health-data consent,
 * A-054 accepted policy version) against the real local Postgres. Completing
 * the wizard stamps confirmedAdultAt + healthDataConsentAt/Version +
 * acknowledgedPolicyVersion and writes the new profile private-by-default
 * (discoverable:false, A-049). The schema refinements reject a submit missing
 * the age attestation or the health-data consent, and nothing is written then.
 */

const RUN_ID = `onb-${Date.now()}`;
let current: { id: string; name: string } | null = null;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return current;
  },
}));
vi.mock("@/lib/auth/refresh-session", () => ({ refreshSessionCache: async () => {} }));
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

const { completeOnboarding } = await import("./onboarding");

const userIds: string[] = [];

async function makeUser(label: string) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, username: `${label}_${Date.now().toString(36)}`.slice(0, 30) },
  });
  userIds.push(id);
  return { id, name: label };
}

/** A complete, valid wizard submission; override or delete fields to probe the gates. */
function form(overrides: Record<string, string | null> = {}): FormData {
  const fd = new FormData();
  fd.set("displayName", "Fulano");
  fd.set("goal", "HYPERTROPHY");
  fd.set("experience", "BEGINNER");
  fd.set("daysPerWeek", "3");
  fd.set("sessionMinutes", "60");
  fd.set("equipmentAccess", "FULL_GYM");
  fd.set("doesEndurance", "off");
  fd.set("confirmedAdult", "on");
  fd.set("healthConsent", "on");
  fd.set("next", "");
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) fd.delete(k);
    else fd.set(k, v);
  }
  return fd;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("completeOnboarding (A-008/A-049/A-054)", () => {
  it("stamps age + versioned consent + accepted policy and writes a private-by-default profile", async () => {
    const user = await makeUser("consenting");
    current = { id: user.id, name: user.name };

    let thrown: unknown;
    try {
      await completeOnboarding({}, form());
    } catch (err) {
      thrown = err;
    }
    // Success redirects to the next path.
    expect(thrown).toBeInstanceOf(Redirected);

    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.confirmedAdultAt).toBeInstanceOf(Date);
    expect(profile.healthDataConsentAt).toBeInstanceOf(Date);
    expect(profile.healthDataConsentVersion).toBe(POLICY_VERSION);
    expect(profile.acknowledgedPolicyVersion).toBe(POLICY_VERSION);
    // A-049: NEW_PROFILE_SHARING writes the new account not discoverable.
    expect(profile.discoverable).toBe(false);
    expect(profile.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it("rejects a submit missing BOTH the age attestation and the health-data consent, writing no profile", async () => {
    const user = await makeUser("refusing");
    current = { id: user.id, name: user.name };

    const result = await completeOnboarding({}, form({ confirmedAdult: null, healthConsent: null }));
    expect(result.error).toBe("Revise os campos destacados.");
    expect(result.fieldErrors).toBeDefined();
    expect(result.fieldErrors).toHaveProperty("confirmedAdult");
    expect(result.fieldErrors).toHaveProperty("healthConsent");
    expect(await prisma.profile.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rejects a submit with the age attestation but no health-data consent", async () => {
    const user = await makeUser("halfway");
    current = { id: user.id, name: user.name };

    const result = await completeOnboarding({}, form({ healthConsent: null }));
    expect(result.fieldErrors).toHaveProperty("healthConsent");
    expect(result.fieldErrors).not.toHaveProperty("confirmedAdult");
    expect(await prisma.profile.count({ where: { userId: user.id } })).toBe(0);
  });
});
