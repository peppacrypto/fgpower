import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signLink } from "@/lib/links/signed";
import { digestStateForToken, resubscribeDigestByToken, unsubscribeDigestByToken } from "./unsubscribe";

/** The digest's no-login unsubscribe against the real local Postgres (dev e-mail transport: e-mail is on). */

const TAG = `unsub-${Date.now()}`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: TAG } } });
  await prisma.$disconnect();
});

async function user(label: string, pref: { pausedAt?: Date | null; emailDigest?: boolean }) {
  const id = `${TAG}-${label}`;
  await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  await prisma.reminderPreference.create({ data: { userId: id, emailDigest: pref.emailDigest ?? true, pausedAt: pref.pausedAt ?? null } });
  return id;
}

describe("the digest's unsubscribe link", () => {
  it("cancels, and 'Reativar resumo' opts in again — which lifts a pause, like Settings", async () => {
    const pausedAt = new Date(Date.now() - 3 * 86_400_000);
    const id = await user("paused", { pausedAt });
    const token = signLink("unsub", { u: id });

    expect(await unsubscribeDigestByToken(token)).toBe(true);
    expect(await digestStateForToken(token)).toMatchObject({ userId: id, subscribed: false });
    const off = await prisma.reminderPreference.findUniqueOrThrow({ where: { userId: id } });
    expect(off.emailDigest).toBe(false);
    expect(off.emailUnsubscribedAt).not.toBeNull();
    // Cancelling is not opting in: the pause stays.
    expect(off.pausedAt).toEqual(pausedAt);

    expect(await resubscribeDigestByToken(token)).toBe(true);
    const on = await prisma.reminderPreference.findUniqueOrThrow({ where: { userId: id } });
    expect(on).toMatchObject({ emailDigest: true, emailUnsubscribedAt: null, pausedAt: null, pausedReason: null });
    expect(on.resumedAt).not.toBeNull();
    expect(on.emailDigestOptInAt).not.toBeNull();
  });

  it("a user who wasn't paused keeps an empty resume mark; a forged or click token does nothing", async () => {
    const id = await user("active", { emailDigest: false });
    expect(await resubscribeDigestByToken(signLink("unsub", { u: id }))).toBe(true);
    const on = await prisma.reminderPreference.findUniqueOrThrow({ where: { userId: id } });
    expect(on).toMatchObject({ emailDigest: true, pausedAt: null, resumedAt: null });

    const click = signLink("click", { u: id });
    expect(await unsubscribeDigestByToken(click)).toBe(false);
    expect(await unsubscribeDigestByToken(`${click}x`)).toBe(false);
    expect(await digestStateForToken("nope")).toBeNull();
    expect((await prisma.reminderPreference.findUniqueOrThrow({ where: { userId: id } })).emailDigest).toBe(true);
  });
});
