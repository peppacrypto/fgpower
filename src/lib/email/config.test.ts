import { afterEach, describe, expect, it, vi } from "vitest";
import { emailEnabled, emailTransport } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

function env(p: { node: string; key?: string; from?: string; transport?: string }) {
  vi.stubEnv("NODE_ENV", p.node);
  vi.stubEnv("RESEND_API_KEY", p.key ?? "");
  vi.stubEnv("EMAIL_FROM", p.from ?? "");
  vi.stubEnv("EMAIL_TRANSPORT", p.transport ?? "");
}

describe("emailTransport", () => {
  it("uses Resend when the key and sender are set", () => {
    env({ node: "production", key: "re_x", from: "FGPOWER <a@fgpower.monster>" });
    expect(emailTransport()).toBe("resend");
    env({ node: "development", key: "re_x", from: "FGPOWER <a@fgpower.monster>" });
    expect(emailTransport()).toBe("resend");
  });

  it("is off in production without Resend — never the dev transport", () => {
    env({ node: "production" });
    expect(emailTransport()).toBe("off");
    env({ node: "production", key: "re_x" });
    expect(emailTransport()).toBe("off");
    env({ node: "production", transport: "dev" });
    expect(emailTransport()).toBe("off");
    expect(emailEnabled()).toBe(false);
  });

  it("uses the dev transport outside production without Resend", () => {
    env({ node: "development" });
    expect(emailTransport()).toBe("dev");
    env({ node: "test" });
    expect(emailTransport()).toBe("dev");
    expect(emailEnabled()).toBe(true);
  });

  it("honours EMAIL_TRANSPORT=off and =dev (outside production)", () => {
    env({ node: "development", key: "re_x", from: "x@y.z", transport: "off" });
    expect(emailTransport()).toBe("off");
    env({ node: "development", key: "re_x", from: "x@y.z", transport: "dev" });
    expect(emailTransport()).toBe("dev");
    env({ node: "development", transport: "resend" });
    expect(emailTransport()).toBe("off");
  });
});
