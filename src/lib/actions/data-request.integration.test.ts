import "dotenv/config";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

/**
 * The LGPD art. 18 data-subject request channel (A-050) against the real local
 * Postgres. submitDataRequest is PUBLIC: it records a DataRequest for anyone,
 * attaching the signed-in user's id when present and leaving it null when not.
 * A bad e-mail is refused and writes nothing. A per-IP cap is the abuse control
 * for the public form — the 6th request from one IP in the window is refused.
 */

const RUN_ID = `dreq-${Date.now()}`;
let ip = "198.51.100.1";
let session: { user: { id: string } } | null = null;

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": ip }) }));
vi.mock("@/lib/auth/require-user", () => ({ getCurrentSessionAllowBanned: async () => session }));

const { submitDataRequest } = await import("./data-request");

const userIds: string[] = [];
const emailsUsed: string[] = [];

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function makeUser(label: string) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, username: `${label}_${Date.now().toString(36)}`.slice(0, 30) },
  });
  userIds.push(id);
  return { id };
}

async function latestFor(email: string) {
  emailsUsed.push(email);
  return prisma.dataRequest.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
}

afterAll(async () => {
  await prisma.dataRequest.deleteMany({ where: { email: { in: emailsUsed } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("submitDataRequest", () => {
  it("records a request with no userId when logged out", async () => {
    ip = `${RUN_ID}-anon`;
    session = null;
    const email = `anon.${RUN_ID}@example.com`;
    expect(await submitDataRequest({}, form({ email, kind: "ACCESS", message: "quero meus dados" }))).toEqual({ done: true });

    const row = await latestFor(email);
    expect(row).not.toBeNull();
    expect(row!.userId).toBeNull();
    expect(row!.kind).toBe("ACCESS");
    expect(row!.message).toBe("quero meus dados");
    expect(row!.status).toBe("OPEN");
  });

  it("attaches the signed-in user's id when present", async () => {
    const user = await makeUser("signedin");
    ip = `${RUN_ID}-signed`;
    session = { user: { id: user.id } };
    const email = `signed.${RUN_ID}@example.com`;
    expect(await submitDataRequest({}, form({ email, kind: "DELETE" }))).toEqual({ done: true });

    const row = await latestFor(email);
    expect(row!.userId).toBe(user.id);
    expect(row!.kind).toBe("DELETE");
    expect(row!.message).toBeNull();
  });

  it("refuses a bad e-mail and writes nothing", async () => {
    ip = `${RUN_ID}-bad`;
    session = null;
    const result = await submitDataRequest({}, form({ email: "not-an-email", kind: "ACCESS" }));
    expect(result).toEqual({ error: "Confira o e-mail e tente de novo." });
    // Nothing recorded for the (would-be) address.
    expect(await prisma.dataRequest.count({ where: { email: "not-an-email" } })).toBe(0);
  });

  it("holds back a burst from one IP: the sixth in the window is refused", async () => {
    ip = `${RUN_ID}-flood`;
    session = null;
    for (let i = 0; i < 5; i++) {
      const email = `flood.${i}.${RUN_ID}@example.com`;
      emailsUsed.push(email);
      expect(await submitDataRequest({}, form({ email, kind: "ACCESS" })), `request ${i + 1}`).toEqual({ done: true });
    }
    const sixth = `flood.6.${RUN_ID}@example.com`;
    expect(await submitDataRequest({}, form({ email: sixth, kind: "ACCESS" }))).toEqual({
      error: "Muitas solicitações. Tente novamente mais tarde.",
    });
    // The capped request left no row.
    expect(await prisma.dataRequest.count({ where: { email: sixth } })).toBe(0);
  });
});
