import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { getCurrentSessionAllowBanned } from "@/lib/auth/require-user";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal/policy";
import { DataRequestForm } from "./data-request-form";

export const metadata: Metadata = { title: "Solicitar seus dados" };

/**
 * A-050 / A-009 — the LGPD art. 18 data-subject request channel. PUBLIC (under
 * /(marketing), outside /app, so the proxy never gates it): a logged-out OR a
 * suspended user can file an access / deletion / correction / portability
 * request here. The signed-in user's id and e-mail prefill when available.
 *
 * [OWNER/LEGAL: this records a request for manual fulfilment — it does NOT
 * itself export or erase. State the response time and the ANPD petition right
 * in the policy-content spec. PRIVACY_CONTACT_EMAIL is shown only if set.]
 */
export default async function DataRequestPage() {
  const session = await getCurrentSessionAllowBanned();
  return (
    <MarketingShell>
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Solicitar seus dados</h1>
        <p className="mt-2 text-sm text-muted">
          {/* [OWNER/LEGAL: texto dos direitos do titular (art. 18) + prazo de resposta — placeholder.] */}
          Use este canal para pedir acesso, correção, portabilidade ou exclusão dos seus dados pessoais.
        </p>
        <DataRequestForm
          defaultEmail={session?.user.email ?? ""}
          contactEmail={PRIVACY_CONTACT_EMAIL}
        />
      </div>
    </MarketingShell>
  );
}
