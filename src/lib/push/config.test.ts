import { afterEach, describe, expect, it, vi } from "vitest";
import { pushAvailable, pushTransport, vapidPublicKey } from "./config";

/** Which push transport runs, and when push is offered at all (hidden, never broken, without keys). */

function env(p: { node: string; pub?: string; priv?: string; subject?: string; transport?: string }) {
  vi.stubEnv("NODE_ENV", p.node);
  vi.stubEnv("VAPID_PUBLIC_KEY", p.pub ?? "");
  vi.stubEnv("VAPID_PRIVATE_KEY", p.priv ?? "");
  vi.stubEnv("VAPID_SUBJECT", p.subject ?? "");
  vi.stubEnv("PUSH_TRANSPORT", p.transport ?? "");
}
const keys = { pub: "BPublicKey", priv: "privateKey", subject: "mailto:admin@fgpower.monster" };

afterEach(() => vi.unstubAllEnvs());

describe("push config", () => {
  it("production without VAPID keys: off, nothing offered", () => {
    env({ node: "production" });
    expect(pushTransport()).toBe("off");
    expect(vapidPublicKey()).toBeNull();
    expect(pushAvailable()).toBe(false);
  });

  it("with the keys and a valid subject: Web Push, and the page gets the public key", () => {
    env({ node: "production", ...keys });
    expect(pushTransport()).toBe("webpush");
    expect(vapidPublicKey()).toBe("BPublicKey");
    env({ node: "production", ...keys, subject: "https://fgpower.monster" });
    expect(pushAvailable()).toBe(true);
  });

  it("a subject the push services would refuse counts as no keys", () => {
    env({ node: "production", ...keys, subject: "admin@fgpower.monster" });
    expect(pushTransport()).toBe("off");
    env({ node: "development", ...keys, subject: "http://localhost" });
    expect(pushTransport()).toBe("dev");
    expect(pushAvailable()).toBe(false);
  });

  it("PUSH_TRANSPORT=off always wins; =dev never reaches production", () => {
    env({ node: "production", ...keys, transport: "off" });
    expect(pushTransport()).toBe("off");
    expect(vapidPublicKey()).toBeNull();
    env({ node: "production", ...keys, transport: "dev" });
    expect(pushTransport()).toBe("webpush");
    env({ node: "production", transport: "dev" });
    expect(pushTransport()).toBe("off");
  });

  it("outside production without keys: the dev transport, but no key to subscribe with (push stays hidden)", () => {
    env({ node: "development" });
    expect(pushTransport()).toBe("dev");
    expect(pushAvailable()).toBe(false);
  });
});
