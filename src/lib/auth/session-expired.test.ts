import { describe, expect, it } from "vitest";
import { isSessionExpiredError, loginAgainHref, SESSION_EXPIRED_ERROR } from "./session-expired";

describe("session-expired helpers", () => {
  it("recognises the message, also with text appended", () => {
    expect(isSessionExpiredError(SESSION_EXPIRED_ERROR)).toBe(true);
    expect(isSessionExpiredError(`${SESSION_EXPIRED_ERROR} A alteração foi desfeita.`)).toBe(true);
    expect(isSessionExpiredError("Sem conexão.")).toBe(false);
    expect(isSessionExpiredError(null)).toBe(false);
  });

  it("returns to app pages (the wizard included) only and always flags the expiry", () => {
    expect(loginAgainHref("/app/settings")).toBe("/login?next=%2Fapp%2Fsettings&sessao=expirada");
    expect(loginAgainHref("/u/maria?x=1")).toBe("/login?next=%2Fu%2Fmaria%3Fx%3D1&sessao=expirada");
    // The wizard keeps where it was going to end (a program picked before sign-in).
    expect(loginAgainHref("/onboarding?next=/app/programs/templates/gd-1")).toBe(
      "/login?next=%2Fonboarding%3Fnext%3D%2Fapp%2Fprograms%2Ftemplates%2Fgd-1&sessao=expirada",
    );
    expect(loginAgainHref("/login")).toBe("/login?sessao=expirada");
    expect(loginAgainHref("//evil.com")).toBe("/login?sessao=expirada");
  });
});
