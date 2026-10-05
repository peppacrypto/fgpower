import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TermsPage from "./page";
import { CONTROLLER_NAME, MINIMUM_AGE, POLICY_DISPLAY_VERSION, POLICY_LAST_UPDATED } from "@/lib/legal/policy";

/**
 * /terms is a static server component. With the controller identity, contact
 * and minimum age still EMPTY (lib/legal/policy), it shows the review banner
 * and degrades those lines gracefully — never printing a raw `[OWNER…]` marker
 * (A-009/A-049 page copy).
 */

const html = () => renderToStaticMarkup(createElement(TermsPage));

describe("TermsPage", () => {
  it("renders the date/version line and the always-present sections", () => {
    const out = html();
    expect(out).toContain(POLICY_LAST_UPDATED);
    expect(out).toContain(`Versão ${POLICY_DISPLAY_VERSION}`);
    expect(out).toContain("outubro de 2026");
    expect(out).toContain("Versão 2.0");
    for (const heading of ["Quem oferece a FGPOWER", "Idade mínima", "Aviso educacional, não médico"]) {
      expect(out, heading).toContain(heading);
    }
  });

  it("shows the review banner while the legal constants are empty", () => {
    expect(CONTROLLER_NAME).toBe("");
    expect(MINIMUM_AGE).toBe("");
    expect(html()).toContain("Em revisão jurídica.");
  });

  it("never prints a raw [OWNER…] or [COUNSEL…] placeholder marker", () => {
    const out = html();
    expect(out).not.toMatch(/\[OWNER/);
    expect(out).not.toMatch(/\[COUNSEL/);
    // The data-subject channel is the fallback while there is no real contact.
    expect(out).toContain("/privacidade/solicitar");
  });
});
