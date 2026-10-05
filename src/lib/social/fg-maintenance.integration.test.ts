import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { recountFgForDeletedGiver } from "./fg-maintenance";
import { auth } from "@/lib/auth/auth";

/**
 * Account deletion & ghost FGs (A-047) against the real local Postgres. When a
 * giver deletes their account the DB cascades their ActivityFG rows away but
 * never touches the denormalized Activity.fgCount, so the posts they had given
 * FG to keep counting a giver who no longer exists. recountFgForDeletedGiver
 * removes the rows and recomputes the counter BEFORE the cascade; the better-
 * auth deleteUser.beforeDelete hook runs it on a real /delete-user.
 */

const RUN_ID = `fgm-${Date.now()}`;
const ORIGIN = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
const PASSWORD = "fgm-test-password-not-real-123!";
const userIds: string[] = [];

async function makeUser(label: string) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, username: `${label}_${Date.now().toString(36)}`.slice(0, 30) },
  });
  await prisma.profile.create({ data: { userId: id, displayName: label, onboardingCompletedAt: new Date() } });
  userIds.push(id);
  return { id };
}

/** A completed workout + its PUBLIC post, fgCount starting at 0. */
async function makePost(ownerId: string) {
  const at = new Date(Date.now() - 3_600_000);
  const session = await prisma.workoutSession.create({
    data: { userId: ownerId, name: "Pernas", status: "COMPLETED", startedAt: at, finishedAt: at, visibility: "PUBLIC", updatedAt: at },
  });
  const activity = await prisma.activity.create({
    data: { userId: ownerId, type: "WORKOUT", sessionId: session.id, visibility: "PUBLIC", summary: { workoutName: "Pernas" } },
  });
  return activity.id;
}

/** A giver's FG on a post, keeping fgCount honest (as giveFg does). */
async function giveFg(activityId: string, userId: string) {
  await prisma.activityFG.create({ data: { activityId, userId } });
  await prisma.activity.update({ where: { id: activityId }, data: { fgCount: { increment: 1 } } });
}

const fgCountOf = async (activityId: string) =>
  (await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, select: { fgCount: true } })).fgCount;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await prisma.$disconnect();
});

describe("recountFgForDeletedGiver", () => {
  it("drops the giver's FGs and recomputes fgCount on each affected post", async () => {
    const author = await makeUser("author");
    const giverA = await makeUser("giverA");
    const giverB = await makeUser("giverB");
    const post = await makePost(author.id);
    await giveFg(post, giverA.id);
    await giveFg(post, giverB.id);
    expect(await fgCountOf(post)).toBe(2);

    await recountFgForDeletedGiver(giverA.id);

    // giverA's row is gone and the counter dropped to the real remaining count.
    expect(await fgCountOf(post)).toBe(1);
    expect(await prisma.activityFG.count({ where: { activityId: post } })).toBe(1);
    expect(await prisma.activityFG.count({ where: { activityId: post, userId: giverA.id } })).toBe(0);
    expect(await prisma.activityFG.count({ where: { activityId: post, userId: giverB.id } })).toBe(1);

    // The user cascade that follows finds no rows left and the count stays correct.
    await prisma.user.delete({ where: { id: giverA.id } });
    userIds.splice(userIds.indexOf(giverA.id), 1);
    expect(await fgCountOf(post)).toBe(1);
  });

  it("is idempotent — a second run changes nothing, a giver with no FGs is a no-op", async () => {
    const author = await makeUser("author2");
    const giver = await makeUser("giverC");
    const bystander = await makeUser("bystander");
    const post = await makePost(author.id);
    await giveFg(post, giver.id);
    expect(await fgCountOf(post)).toBe(1);

    await recountFgForDeletedGiver(giver.id);
    expect(await fgCountOf(post)).toBe(0);
    // Running again (the row already gone) neither throws nor drifts the count.
    await expect(recountFgForDeletedGiver(giver.id)).resolves.toBeUndefined();
    expect(await fgCountOf(post)).toBe(0);
    // A giver who never gave an FG: a clean no-op.
    await expect(recountFgForDeletedGiver(bystander.id)).resolves.toBeUndefined();
  });
});

describe("deleteUser.beforeDelete hook (end to end)", () => {
  beforeAll(() => {
    vi.stubEnv("EMAIL_TRANSPORT", "dev");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("a real /delete-user recounts the posts the account had FG'd before the cascade", async () => {
    const email = `${RUN_ID}-leaver@fgpower.dev`;
    const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "Leaver" }, asResponse: true });
    expect(res.ok).toBe(true);
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const leaver = await prisma.user.findUniqueOrThrow({ where: { email } });

    const author = await makeUser("author3");
    const post = await makePost(author.id);
    await giveFg(post, leaver.id);
    expect(await fgCountOf(post)).toBe(1);

    const deleted = await auth.handler(
      new Request(`${ORIGIN}/api/auth/delete-user`, {
        method: "POST",
        headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(deleted.status).toBe(200);

    // The account is gone; the post it had FG'd settles back to 0, no ghost giver.
    expect(await prisma.user.count({ where: { id: leaver.id } })).toBe(0);
    expect(await fgCountOf(post)).toBe(0);
    expect(await prisma.activityFG.count({ where: { activityId: post } })).toBe(0);
  });
});
