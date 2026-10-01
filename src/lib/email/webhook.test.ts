import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvix } from "./webhook";

const secretBytes = Buffer.from("test-webhook-secret-bytes");
const secret = `whsec_${secretBytes.toString("base64")}`;
function sign(id: string, ts: number, body: string) {
  return createHmac("sha256", secretBytes).update(`${id}.${ts}.${body}`).digest("base64");
}

describe("verifySvix", () => {
  const body = JSON.stringify({ type: "email.bounced" });
  const now = 1_800_000_000;
  const headers = (sig: string, ts = now) => new Headers({ "svix-id": "msg_1", "svix-timestamp": String(ts), "svix-signature": sig });

  it("accepts a valid v1 signature among several", () => {
    expect(verifySvix(secret, headers(`v1,${sign("msg_1", now, body)}`), body, now)).toBe(true);
    expect(verifySvix(secret, headers(`v1,AAAA v1,${sign("msg_1", now, body)}`), body, now)).toBe(true);
  });

  it("refuses a tampered body, a wrong secret, an old timestamp and missing headers", () => {
    const sig = `v1,${sign("msg_1", now, body)}`;
    expect(verifySvix(secret, headers(sig), `${body} `, now)).toBe(false);
    expect(verifySvix(`whsec_${Buffer.from("other").toString("base64")}`, headers(sig), body, now)).toBe(false);
    expect(verifySvix(secret, headers(`v1,${sign("msg_1", now - 600, body)}`, now - 600), body, now)).toBe(false);
    expect(verifySvix(secret, new Headers(), body, now)).toBe(false);
    expect(verifySvix(secret, headers(`v2,${sign("msg_1", now, body)}`), body, now)).toBe(false);
  });
});
