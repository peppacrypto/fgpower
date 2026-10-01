import { describe, expect, it } from "vitest";
import { BANNED_TEXT, isBanned, isDeadCode, oauthErrorView, sendCodeErrorText, signInErrorText } from "./sign-in-errors";

describe("sign-in errors in pt-BR", () => {
  it("a suspended account is told so — never 'tente de novo' — by the code and by the link", () => {
    const banned = { status: 403, code: "BANNED_USER" };
    expect(signInErrorText(banned)).toBe(BANNED_TEXT);
    expect(BANNED_TEXT).not.toMatch(/tente de novo/i);
    expect(isBanned(banned)).toBe(true);
    // Not a dead code: a new link wouldn't help either (the link page drops its button instead).
    expect(isDeadCode(banned)).toBe(false);
    expect(isBanned({ status: 400, code: "INVALID_OTP" })).toBe(false);
  });

  it("the code's own failures keep their words", () => {
    expect(signInErrorText({ code: "INVALID_OTP" })).toBe("Código incorreto. Confira e tente de novo.");
    expect(signInErrorText({ code: "OTP_EXPIRED" })).toBe("Este código expirou. Peça um novo.");
    expect(signInErrorText({ code: "TOO_MANY_ATTEMPTS" })).toBe("Muitas tentativas com este código. Peça um novo.");
    expect(signInErrorText({ status: 429 })).toBe("Muitas tentativas. Espere um minuto e tente de novo.");
    expect(signInErrorText(null)).toBe("Não foi possível entrar agora. Tente de novo.");
    expect(sendCodeErrorText({ code: "INVALID_EMAIL" })).toBe("Confira o e-mail digitado.");
  });

  it("Google's return: cancelled, suspended, or anything else with its code", () => {
    expect(oauthErrorView(undefined)).toBeNull();
    expect(oauthErrorView("access_denied")).toEqual({
      text: "O login com o Google foi cancelado. Tente de novo quando quiser.",
      code: null,
    });
    expect(oauthErrorView("BANNED_USER")).toEqual({ text: BANNED_TEXT, code: null });
    expect(oauthErrorView("invalid_code")).toEqual({
      text: "Não foi possível entrar com o Google. Tente de novo em instantes.",
      code: "invalid_code",
    });
    // Anything that isn't a short snake_case code is never printed back.
    expect(oauthErrorView("<script>")?.code).toBe("erro");
    expect(oauthErrorView("Banned_User")?.code).toBe("erro");
    expect(oauthErrorView("x".repeat(65))?.code).toBe("erro");
  });
});
