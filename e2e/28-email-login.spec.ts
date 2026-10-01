import { expect, test, type Page } from "@playwright/test";
import { IPHONE, loginAsTestUser, readOutbox, sql, sqlText, userIdOf } from "./fixtures";
import { codeFrom, linkFrom, requestLoginEmail, uniqueAddress } from "./email-helpers";

/**
 * Sign in by e-mail (decision 13, D-D, W-065): one e-mail with a link to a
 * tap-to-confirm page and a 6-digit code. Runs on the dev e-mail transport
 * (outside production e-mail is always "on"; production without Resend
 * hides the form — covered by unit tests of lib/email/config and login-gate).
 */

test.use({ ...IPHONE, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

const codeBox = (page: Page) => page.getByLabel("Código de 6 dígitos");
/** The form's error line (Next's empty route announcer is an alert too). */
const alertLine = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ });

async function finishWizard(page: Page, name: string) {
  await expect(page).toHaveURL(/\/onboarding/);
  const field = page.getByLabel("Nome de exibição");
  // A new e-mail account has no name: the wizard starts blank.
  await expect(field).toHaveValue("");
  await field.fill(name);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Ver meu plano" }).click();
}

test("a new address: the code signs up, onboarding names the account, Today opens", async ({ page }) => {
  const email = uniqueAddress("mail-code");
  await page.goto("/login");
  await expect(page.getByRole("separator", { name: "ou" })).toBeVisible();
  await expect(page.getByText("Enviamos um link e um código de 6 dígitos. Sem senha.")).toBeVisible();

  // A malformed address never leaves the phone.
  await page.getByLabel("E-mail", { exact: true }).fill("ana@");
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(alertLine(page)).toHaveText("Confira o e-mail digitado.");
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveAttribute("aria-invalid", "true");

  const message = await requestLoginEmail(page, email);
  const code = codeFrom(message);
  // The log never keeps the code (the real subject carries it: templates/login-code.test.ts).
  expect(message.subject).toBe("Código de acesso FGPOWER: ••••••");
  expect(message.devBody).toContain(`${code.slice(0, 3)} ${code.slice(3)}`);
  expect(message.devBody).toContain("O link vale por 10 minutos e funciona uma vez.");
  expect(message.devBody).toContain("Se você não pediu este acesso, ignore este e-mail — ninguém entra sem ele.");
  // The address and the code ride in the fragment, never in a query string.
  expect(linkFrom(message)).toMatch(/^\/login\/link#e=.+&c=\d{6}$/);

  await expect(page.getByText(`Enviamos um link de acesso para ${email}.`)).toBeVisible();
  await expect(codeBox(page)).toBeFocused();
  await expect(codeBox(page)).toHaveAttribute("autocomplete", "one-time-code");
  await expect(codeBox(page)).toHaveAttribute("inputmode", "numeric");
  await expect(page.getByRole("button", { name: /reenviar em \d+ s/ })).toBeDisabled();

  // Six digits sign in by themselves.
  await codeBox(page).fill(code);
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  await finishWizard(page, "Rosa Maria");
  await page.waitForURL(/\/app\/today/, { timeout: 30_000 });

  const id = await userIdOf(page);
  expect(sql(`SELECT name || '|' || "emailVerified" || '|' || email FROM "user" WHERE id = ${sqlText(id)}`)).toBe(
    `Rosa Maria|true|${email}`,
  );
});

test("the link: a tap on Entrar signs in, a used link says so, and a new one is one tap away", async ({ browser }) => {
  const email = uniqueAddress("mail-link");
  // Signed up (and onboarded) from a program page: the wizard ends there.
  const first = await browser.newContext(IPHONE);
  const page = await first.newPage();
  await page.goto("/login?next=/app/programs");
  const signup = await requestLoginEmail(page, email);
  await codeBox(page).fill(codeFrom(signup));
  await finishWizard(page, "Lia");
  await page.waitForURL(/\/app\/programs/, { timeout: 30_000 });
  const id = await userIdOf(page);
  await first.close();

  // Later, on another device: the link from a new e-mail.
  const second = await browser.newContext(IPHONE);
  const phone = await second.newPage();
  await phone.goto("/login?next=/app/history");
  const message = await requestLoginEmail(phone, email);
  const link = linkFrom(message);
  expect(link).toContain("next=%2Fapp%2Fhistory");
  await phone.goto(link);
  await expect(phone.getByRole("heading", { level: 1, name: "Entrar na FGPOWER" })).toBeVisible();
  await expect(phone.getByText(/^como m•••@fgpower\.dev$/)).toBeVisible();
  // Opening the page signs nobody in, and the code leaves the address bar.
  await expect(phone).toHaveURL(/\/login\/link$/);
  expect((await phone.request.get("/api/auth/get-session").then((r) => r.json())) ?? null).toBeNull();
  await phone.getByRole("button", { name: "Entrar" }).click();
  // Onboarded: straight on to where the sign-in started.
  await phone.waitForURL(/\/app\/history/, { timeout: 30_000 });
  expect(await userIdOf(phone)).toBe(id);
  await second.close();

  // The same link again (a forwarded e-mail, a second tap): dead, with a way on.
  const third = await browser.newContext(IPHONE);
  const again = await third.newPage();
  await again.goto(link);
  await again.getByRole("button", { name: "Entrar" }).click();
  await expect(again.getByRole("heading", { level: 1, name: "Este link expirou ou já foi usado." })).toBeVisible();
  await again.getByRole("link", { name: "Pedir um novo link" }).click();
  await again.waitForURL(/\/login\?/);
  expect(new URL(again.url()).searchParams.get("next")).toBe("/app/history");
  await expect(again.getByLabel("E-mail", { exact: true })).toHaveValue(email);

  // A link without its code is the same dead end.
  await again.goto("/login/link");
  await expect(again.getByRole("heading", { level: 1, name: "Este link expirou ou já foi usado." })).toBeVisible();
  await third.close();
});

test("wrong codes: told so, then the code dies after 3; resend and another address", async ({ page }) => {
  const email = uniqueAddress("mail-wrong");
  await page.goto("/login");
  const message = await requestLoginEmail(page, email);
  const code = codeFrom(message);
  const wrong = code === "000000" ? "111111" : "000000";

  await codeBox(page).fill(wrong);
  await expect(alertLine(page)).toHaveText("Código incorreto. Confira e tente de novo.");
  await expect(codeBox(page)).toHaveAttribute("aria-invalid", "true");
  for (let i = 0; i < 2; i++) {
    await codeBox(page).fill("");
    await codeBox(page).fill(wrong);
    await expect(alertLine(page)).toHaveText("Código incorreto. Confira e tente de novo.");
  }
  // Three wrong tries: even the right code no longer works.
  await codeBox(page).fill("");
  await codeBox(page).fill(code);
  await expect(alertLine(page)).toHaveText("Muitas tentativas com este código. Peça um novo.");
  await expect(page).toHaveURL(/\/login/);

  // "usar outro e-mail" goes back to the address, kept.
  await page.getByRole("button", { name: "usar outro e-mail" }).click();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(email);
  await expect(page.getByLabel("E-mail", { exact: true })).toBeFocused();

  // A new code works.
  const fresh = await requestLoginEmail(page, email);
  await codeBox(page).fill(codeFrom(fresh));
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
});

test("an existing account signs in to the same user; an address past its budget is refused", async ({ page, browser }) => {
  // Made through the test route (unverified password account): its first e-mail proof keeps the user.
  const email = uniqueAddress("mail-existing");
  await loginAsTestUser(page, email, "Conta Antiga");
  const id = await userIdOf(page);
  await page.context().clearCookies();

  await page.goto("/login");
  const message = await requestLoginEmail(page, email);
  await codeBox(page).fill(codeFrom(message));
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  expect(await userIdOf(page)).toBe(id);

  // Five codes an hour per address: the sixth is refused, and says why.
  const busy = uniqueAddress("mail-budget");
  const ctx = await browser.newContext(IPHONE);
  const other = await ctx.newPage();
  await other.goto("/login");
  for (let i = 0; i < 5; i++) {
    const res = await other.request.post("/api/auth/email-otp/send-verification-otp", {
      data: { email: busy, type: "sign-in" },
      headers: { origin: new URL(other.url()).origin },
    });
    expect(res.status()).toBe(200);
  }
  await readOutbox(other, busy, { kind: "LOGIN_CODE" });
  expect(sql(`SELECT count(*) FROM "EmailMessage" WHERE "toEmail" = ${sqlText(busy)} AND kind = 'LOGIN_CODE'`)).toBe("5");
  await other.getByLabel("E-mail", { exact: true }).fill(busy);
  await other.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(alertLine(other)).toHaveText(
    "Você já pediu muitos códigos para este e-mail. Tente de novo mais tarde ou entre com o Google.",
  );
  await ctx.close();
});

test("a suspended account is told so — by the code, the link and Google's return — and never signed in", async ({ page }) => {
  const email = uniqueAddress("mail-banned");
  const id = `banned-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Suspended by moderation (the ban sets user.banned).
  sql(
    `INSERT INTO "user" (id, name, email, "emailVerified", banned, "createdAt", "updatedAt") VALUES (${sqlText(id)}, 'Conta Suspensa', ${sqlText(email)}, true, true, now(), now())`,
  );
  const suspended = "Esta conta está suspensa e não pode entrar.";

  await page.goto("/login");
  const first = await requestLoginEmail(page, email);
  await codeBox(page).fill(codeFrom(first));
  await expect(alertLine(page)).toHaveText(suspended);
  await expect(page).toHaveURL(/\/login/);

  // The link from a new e-mail: the same words, and no "Entrar" that could never work.
  await page.getByRole("button", { name: "usar outro e-mail" }).click();
  const second = await requestLoginEmail(page, email);
  await page.goto(linkFrom(second));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(alertLine(page)).toHaveText(suspended);
  await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);
  expect(sql(`SELECT count(*) FROM "session" WHERE "userId" = ${sqlText(id)}`)).toBe("0");

  // Google sends the same refusal back as ?error=BANNED_USER: said plainly, no "Código:" line.
  await page.goto("/login?error=BANNED_USER");
  await expect(alertLine(page)).toHaveText(suspended);
});

test("only the sign-in routes of the e-mail plugin exist, and they take nothing but address and code", async ({
  page,
}) => {
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  const post = (path: string, data: object) =>
    page.request.post(`/api/auth${path}`, { data, headers: { origin } }).then((r) => r.status());
  const email = uniqueAddress("mail-routes");
  expect(await post("/email-otp/check-verification-otp", { email, type: "sign-in", otp: "123456" })).toBe(404);
  expect(await post("/email-otp/verify-email", { email, otp: "123456" })).toBe(404);
  expect(await post("/forget-password/email-otp", { email })).toBe(404);
  expect(await post("/email-otp/request-password-reset", { email })).toBe(404);
  expect(await post("/email-otp/send-verification-otp", { email, type: "email-verification" })).toBe(400);
  expect(await post("/sign-in/email-otp", { email, otp: "123456", image: "http://169.254.169.254/" })).toBe(400);
  expect(await post("/sign-in/email-otp", { email, otp: "123456", name: "Intruso" })).toBe(400);
  // Nothing was sent for any of them.
  expect(sql(`SELECT count(*) FROM "EmailMessage" WHERE "toEmail" = ${sqlText(email)}`)).toBe("0");
});

test("the sent state fits a 320px phone, light and dark", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/login");
  await requestLoginEmail(page, uniqueAddress("mail-320"));
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = (await codeBox(page).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const resend = (await page.getByRole("button", { name: /reenviar/ }).boundingBox())!;
    expect(resend.x + resend.width).toBeLessThanOrEqual(320);
  }
});
