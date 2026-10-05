import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in link's page while e-mail is off (production before Resend, or
 * after it is turned off): an old link must not offer an "Entrar" that can
 * never work — it goes to the login page instead.
 */

const state = vi.hoisted(() => ({ emailOn: true }));

vi.mock("@/lib/email/config", () => ({ emailEnabled: () => state.emailOn }));
vi.mock("@/lib/auth/require-user", () => ({ getCurrentSession: async () => null }));
vi.mock("@/components/brand/logo", () => ({ Wordmark: () => null }));
vi.mock("./link-sign-in", () => ({ LinkSignIn: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { default: LoginLinkPage } = await import("./page");

beforeEach(() => {
  state.emailOn = true;
});

describe("/login/link", () => {
  it("e-mail off: the login page instead of a dead button", async () => {
    state.emailOn = false;
    await expect(LoginLinkPage()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("e-mail on: the tap-to-confirm page", async () => {
    await expect(LoginLinkPage()).resolves.toBeTruthy();
  });

  // A-043: the page redirects on the build-time emailEnabled() read before any
  // dynamic API, so without this it could be prerendered as a static redirect
  // to /login and break the magic-link landing the moment Resend is turned on.
  it("is never statically prerendered: the source forces dynamic rendering", () => {
    const src = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(src).toMatch(/export const dynamic = "force-dynamic"/);
  });
});
