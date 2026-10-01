import { renderEmail } from "../layout";
import { LOGIN_CODE_TTL_SECONDS } from "../login-gate";

/**
 * The sign-in e-mail (W-065): one tap on the link, or the 6-digit code typed
 * in the app (the installed iPhone app has its own cookies, so a link opened
 * from Mail would sign in Safari instead). The link carries the address,
 * the code and where to go next in its FRAGMENT: never sent to a server,
 * so none of them reaches access logs, proxies or a Referer. The subject
 * starts with the code's label so iOS Mail offers it as AutoFill. Pure;
 * transactional (no unsubscribe).
 */

/**
 * The subject as the e-mail log keeps it: never the code, which signs anyone
 * in for 10 minutes (the real subject carries it for iOS AutoFill).
 */
export const LOGIN_CODE_LOG_SUBJECT = "Código de acesso FGPOWER: ••••••";

/** "482913" → "482 913" (easier to read and to type). */
export function formatLoginCode(otp: string): string {
  return /^\d{6}$/.test(otp) ? `${otp.slice(0, 3)} ${otp.slice(3)}` : otp;
}

/** `${origin}/login/link#e=…&c=…[&next=…]` — the tap-to-confirm page (app/login/link). */
export function loginLinkUrl(origin: string, p: { email: string; otp: string; next: string | null }): string {
  const hash = new URLSearchParams({ e: p.email, c: p.otp });
  if (p.next) hash.set("next", p.next);
  return `${origin}/login/link#${hash.toString()}`;
}

export function loginCodeEmail(p: { email: string; otp: string; next: string | null; origin: string }) {
  const minutes = Math.round(LOGIN_CODE_TTL_SECONDS / 60);
  const code = formatLoginCode(p.otp);
  const { html, text } = renderEmail({
    preheader: `Seu código: ${code}. Vale por ${minutes} minutos.`,
    kicker: "FGPOWER · ACESSO",
    title: "Entrar na FGPOWER",
    blocks: [
      {
        type: "paragraph",
        text: `Toque no botão para entrar. O link vale por ${minutes} minutos e funciona uma vez.`,
      },
    ],
    cta: { label: "Entrar na FGPOWER", href: loginLinkUrl(p.origin, p) },
    afterCta: [
      { type: "paragraph", text: "Ou digite este código no app:", muted: true },
      { type: "code", text: code },
    ],
    footer: { lines: ["Se você não pediu este acesso, ignore este e-mail — ninguém entra sem ele."] },
  });
  return { subject: `Código de acesso FGPOWER: ${p.otp}`, html, text };
}
