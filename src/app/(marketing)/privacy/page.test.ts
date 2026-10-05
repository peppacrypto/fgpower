import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";
import {
  CONTROLLER_NAME,
  POLICY_DISPLAY_VERSION,
  POLICY_LAST_UPDATED,
  PRIVACY_CONTACT_EMAIL,
} from "@/lib/legal/policy";

/**
 * /privacy is a static server component built from lib/legal/policy constants.
 * With the owner/legal constants still EMPTY (the shipped state), the page must
 * show the "em revisão jurídica" banner and degrade every placeholder line to
 * honest prose — it must NEVER print a raw `[OWNER…]` / `[COUNSEL…]` marker
 * (A-008/A-009/A-049/A-050/A-051/A-054 page copy). The facts it always states
 * (processors, the art. 18 rights, the sign-in log) render regardless.
 */

const html = () => renderToStaticMarkup(createElement(PrivacyPage));

describe("PrivacyPage", () => {
  it("renders the date/version line from the policy module", () => {
    const out = html();
    expect(out).toContain(POLICY_LAST_UPDATED);
    expect(out).toContain(`Versão ${POLICY_DISPLAY_VERSION}`);
    // The shipped values, so the test also pins the human-facing line.
    expect(out).toContain("outubro de 2026");
    expect(out).toContain("Versão 2.0");
  });

  it("shows the review banner while the legal constants are empty", () => {
    // Guard: this test is written for the un-filled, shipped state.
    expect(CONTROLLER_NAME).toBe("");
    expect(PRIVACY_CONTACT_EMAIL).toBe("");
    expect(html()).toContain("Política em revisão jurídica.");
  });

  it("never prints a raw [OWNER…] or [COUNSEL…] placeholder marker", () => {
    const out = html();
    expect(out).not.toMatch(/\[OWNER/);
    expect(out).not.toMatch(/\[COUNSEL/);
    expect(out).not.toContain("razão social");
    expect(out).not.toContain("CNPJ ou CPF");
  });

  it("states the facts the policy always discloses", () => {
    const out = html();
    for (const heading of [
      "Quem é o controlador",
      "Fale com a gente",
      "Registros de acesso e de lembretes",
      "Base legal",
      "Quem processa seus dados",
      "Idade mínima e menores",
      "Por quanto tempo guardamos",
      "Seus direitos",
    ]) {
      expect(out, heading).toContain(heading);
    }
    // Processors named (A-052).
    for (const processor of ["Railway", "Google", "Resend"]) expect(out, processor).toContain(processor);
    // Art. 18 rights + ANPD (A-050).
    expect(out).toContain("portabilidade");
    expect(out).toContain("revogação do consentimento");
    expect(out).toContain("ANPD");
    // While there is no real contact, the data-request channel is the fallback.
    expect(out).toContain("/privacidade/solicitar");
  });
});
