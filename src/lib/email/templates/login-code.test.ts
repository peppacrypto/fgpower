import { describe, expect, it } from "vitest";
import { formatLoginCode, loginCodeEmail, loginLinkUrl } from "./login-code";

describe("login code e-mail", () => {
  const origin = "https://fgpower.monster";

  it("spaces the code and puts the code in the subject", () => {
    expect(formatLoginCode("482913")).toBe("482 913");
    const m = loginCodeEmail({ email: "ana@gmail.com", otp: "482913", next: null, origin });
    expect(m.subject).toBe("Código de acesso FGPOWER: 482913");
    expect(m.text).toContain("Entrar na FGPOWER");
    expect(m.text).toContain("Toque no botão para entrar. O link vale por 10 minutos e funciona uma vez.");
    expect(m.text).toContain("Ou digite este código no app:\n482 913");
    expect(m.text).toContain("Se você não pediu este acesso, ignore este e-mail — ninguém entra sem ele.");
    expect(m.html).toContain("482 913");
    // Transactional: no unsubscribe.
    expect(m.text).not.toMatch(/cancelar|parar de receber/i);
  });

  it("keeps the address, the code and next in the link's fragment, encoded", () => {
    const link = loginLinkUrl(origin, { email: "a+b@gmail.com", otp: "012345", next: "/app/programs?x=1&y=2" });
    const url = new URL(link);
    expect(url.pathname).toBe("/login/link");
    expect(url.search).toBe("");
    const hash = new URLSearchParams(url.hash.slice(1));
    expect(hash.get("e")).toBe("a+b@gmail.com");
    expect(hash.get("c")).toBe("012345");
    expect(hash.get("next")).toBe("/app/programs?x=1&y=2");
    expect(loginLinkUrl(origin, { email: "a@b.co", otp: "111111", next: null })).not.toContain("next=");
  });

  it("escapes what it interpolates in the HTML", () => {
    const m = loginCodeEmail({ email: `"><script>x</script>@a.co`, otp: "123456", next: null, origin });
    expect(m.html).not.toContain("<script>x");
  });
});
