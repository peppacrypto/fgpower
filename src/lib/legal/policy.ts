/**
 * The current version of FGPOWER's Terms of Use + Privacy Policy, as a plain
 * incrementing string, and the one place health-data consent, the policy
 * re-acknowledge notice, and the /privacy + /terms pages read it from.
 *
 * Bump POLICY_VERSION (and POLICY_EFFECTIVE_DATE, POLICY_DISPLAY_VERSION and
 * POLICY_LAST_UPDATED — the pages' "Última atualização"/"Versão" line reads
 * these, so they stay in sync) whenever the policy changes materially. A user
 * whose Profile.acknowledgedPolicyVersion is not equal to POLICY_VERSION then
 * sees the one-time re-acknowledge notice on Today (A-054); a user whose
 * Profile.healthDataConsentVersion is not equal to it re-consents where
 * consent is the legal basis (A-008).
 *
 * [COUNSEL: what counts as a "material change", the health-data legal basis
 * (art. 7 / art. 11), the exact consent wording below, the minimum age and the
 * handling of minors, and the controller identity + privacy contact are all
 * owner/counsel decisions. See the policy-content spec. The strings here are
 * PLACEHOLDERS and must be replaced before this ships to real users.]
 */
export const POLICY_VERSION = "2026-10";
export const POLICY_EFFECTIVE_DATE = "2026-10-04";

/**
 * Human-facing version + "last updated" line shown on /privacy and /terms.
 * Kept here so the pages and POLICY_VERSION move together (merge: do not let
 * the visible line drift from POLICY_VERSION).
 */
export const POLICY_DISPLAY_VERSION = "2.0";
export const POLICY_LAST_UPDATED = "outubro de 2026";

/**
 * [OWNER/LEGAL: replace with the final, counsel-approved health-data consent
 * sentence. It must name the purposes (fatigue signal, progress, coaching) and
 * state the art. 11 legal basis. Placeholder — do NOT present as final.]
 */
export const HEALTH_CONSENT_TEXT =
  "Concordo que a FGPOWER trate meus dados de saúde (peso, medidas, esforço, dores, sono e estresse) para me mostrar progresso e sinais de fadiga.";

/**
 * [OWNER/LEGAL: a working, monitored privacy contact — e-mail plus the ANPD
 * Res. 2/2022 channel / encarregado. Leave EMPTY until a real channel exists;
 * an empty value renders no fake mailto. Never present a placeholder as real.]
 */
export const PRIVACY_CONTACT_EMAIL: string = "";

// ---------------------------------------------------------------------------
// Owner-fillable LGPD disclosures read by /privacy and /terms.
//
// Every string below is EMPTY until the data controller / counsel fills it.
// The pages NEVER print these raw: a filled value renders as prose, an empty
// one is replaced by a graceful "em revisão" line and flagged by the page's
// "política em revisão" banner. Never fabricate a legal identity, CNPJ, DPO,
// address, contact, age or retention period — leaving it "" is the honest
// state, and the page degrades for it.
// ---------------------------------------------------------------------------

/** [OWNER/LEGAL: razão social / nome do controlador dos dados (LGPD art. 5º, VI).] */
export const CONTROLLER_NAME: string = "";

/** [OWNER/LEGAL: CNPJ ou CPF do controlador, quando aplicável.] */
export const CONTROLLER_REGISTRATION: string = "";

/** [OWNER/LEGAL: endereço/sede do controlador.] */
export const CONTROLLER_ADDRESS: string = "";

/** [OWNER/LEGAL: nome e contato do encarregado (DPO), ou o canal da Resolução ANPD nº 2/2022.] */
export const DPO_CONTACT: string = "";

/** [OWNER/LEGAL: prazo de resposta às solicitações do titular, p. ex. "15 dias".] */
export const PRIVACY_RESPONSE_TIME: string = "";

/** [OWNER/LEGAL: idade mínima para uso (art. 14 para menores), p. ex. "18 anos".] */
export const MINIMUM_AGE: string = "";

/** [OWNER/LEGAL: prazo de retenção dos dados de saúde e de descarte após inatividade/exclusão da conta.] */
export const HEALTH_DATA_RETENTION: string = "";
