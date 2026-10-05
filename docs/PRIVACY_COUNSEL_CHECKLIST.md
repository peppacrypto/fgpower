# Privacy / LGPD counsel + owner checklist

This is the single place that tracks what the **data controller (owner)** and
**legal counsel** must supply and approve before the FGPOWER Privacy Policy
(`/privacy`) and Terms of Use (`/terms`) can be published without the in-page
"política em revisão" banner.

The audit batch B4 shipped the **code mechanisms** (consent capture, versioned
re-acknowledge, the data-request channel, age gate, private-by-default, complete
export) and the **factual page disclosures** (verified against code). It did
**not** — and must not — fabricate any legal identity, contact, DPO, CNPJ,
legal basis, minimum age, or retention period.

Those values live as **empty constants** in `src/lib/legal/policy.ts`. The pages
read them: a filled constant renders as prose; an empty one renders a graceful
"em revisão" line and is flagged by the page banner. No raw `[OWNER/LEGAL: …]` /
`[COUNSEL: …]` token is ever shown to a user — those markers survive only in
`policy.ts` doc comments and in this file.

> Do NOT merge to production for a public launch with the page banner still
> showing (i.e. with any required constant still empty).

---

## 1. Fill these constants in `src/lib/legal/policy.ts`

| Constant | What to put | Finding |
|----------|-------------|---------|
| `CONTROLLER_NAME` | Controller legal name (razão social / nome). | A-009 |
| `CONTROLLER_REGISTRATION` | CNPJ or CPF, when applicable. | A-009 |
| `CONTROLLER_ADDRESS` | Registered / postal address (sede). | A-009 |
| `DPO_CONTACT` | Encarregado (DPO) name + contact, or the ANPD Res. 2/2022 simplified channel. | A-009 |
| `PRIVACY_CONTACT_EMAIL` | A working, monitored privacy e-mail. Empty renders no mailto. | A-009 |
| `PRIVACY_RESPONSE_TIME` | Response-time commitment (e.g. "15 dias"). | A-050 |
| `MINIMUM_AGE` | Minimum age for use (e.g. "18 anos"). | A-049 |
| `HEALTH_DATA_RETENTION` | Retention period for health data + disposal period after account inactivity/deletion. | A-050 |
| `HEALTH_CONSENT_TEXT` | Final, counsel-approved health-data consent sentence (shown at onboarding step 4). | A-008 |

When the policy changes materially, bump `POLICY_VERSION`,
`POLICY_EFFECTIVE_DATE`, `POLICY_DISPLAY_VERSION` and `POLICY_LAST_UPDATED`
together — the pages and the re-acknowledge/consent mechanisms all read them.

---

## 2. COUNSEL checklist — what counsel must confirm / approve

1. **Health-data legal basis (A-008, art. 11).** Confirm whether health data
   (weight, measurements, RPE, soreness, sleep, stress, injury/limitation free
   text) is processed under art. 11, I (specific, highlighted consent) or
   another art. 11 hypothesis, and approve the exact `HEALTH_CONSENT_TEXT`.
2. **International-transfer basis (A-052, art. 33).** Confirm the lawful transfer
   mechanism for storing data (incl. health data) on Railway/Google/Resend/push
   outside Brazil, and the wording.
3. **Minimum age + minors handling (A-049, art. 14).** Decide the minimum age; if
   minors are admitted, define and approve the parental-consent capture and proof.
4. **Art. 18 rights wording + response SLA (A-050).** Approve the rights-list
   phrasing and the stated response time.
5. **Retention periods (A-050).** Set the retention period for health data and the
   descarte/anonymization period after account inactivity or deletion.
6. **ANPD reference.** Approve the statutory ANPD-petition statement (no
   fabricated ANPD contact is added).
7. **Overall sign-off** that the policy is accurate and complete before the draft
   banner is removed.
8. **Re-consent scope for A-054.** Define "material change". Where consent is the
   basis, a version bump must RE-CONSENT (re-stamp `healthDataConsent*`), not
   merely dismiss — the shipped `acknowledgePolicy` only records acknowledgement.
9. **Report-snapshot retention (A-022).** Retaining a `UserReport` snapshot (which
   embeds the reported user's name/handle/caption/bio) **after that user deletes
   their account** is a deliberate retention of personal data for a safety/abuse
   purpose. Confirm it is covered by the stated legal basis before shipping.

---

## 3. OWNER checklist — facts only the owner can state

1. Controller legal name; CNPJ or CPF; registered postal address (A-009).
2. Privacy contact e-mail and response-time commitment (A-009).
3. Encarregado (DPO) name + contact, or the Res. ANPD 2/2022 simplified channel (A-009).
4. The minimum-age value for the age statement (A-049).
5. Confirmation that the processor list (Railway/Google/Resend/push) and their
   regions is complete and current — add any analytics/error-tracking/CDN
   processor not visible in the code (A-052).
6. **Run the migrations in production** (`npx prisma migrate deploy`), then
   `prisma generate` on the deployed build. The A-047 one-off `fgCount` recount
   runs inside `20261004190300_durable_moderation_and_report_retention`.

---

## 4. Residue NOT built in code (flag — do not stub or fake)

- **[OWNER/LEGAL] A-008 — "Retirar consentimento".** Withdrawal that stops
  collection and offers erasure is NOT built (needs the erasure-flow + what-stops
  decision). Flagged, not stubbed.
- **[OWNER/PRODUCT] A-009 — logged-out self-service for banned users.** NOT built.
  better-auth's admin plugin blocks session creation for `banned` accounts and
  BAN deletes all sessions, so self-service export/delete has no session to
  authorize. The compliant mechanism shipped is the public request route
  (`/privacidade/solicitar`) + contact. A true self-service flow would need an
  identity-verified data-access capability independent of better-auth sessions
  (email-OTP → scoped, short-lived token) — a separate, larger decision.
- **[OWNER] A-050 — fulfilment + SLA.** `DataRequest` records requests; nothing
  auto-exports or erases, and no admin review UI is built. The owner must triage
  the `DataRequest` table and respond within the legal window.
- **[OWNER] A-051 — retention + token hygiene.** Purging expired `Session` rows
  (kept past expiry today) and dropping the unused Google OAuth tokens on
  `Account` (`accessToken`/`refreshToken`/`idToken`) are separate hardening items,
  not in this batch.
- **[OWNER/LEGAL] A-050 — older-check-in correction/erasure.** Correction/erasure
  of check-ins older than the 24 h window is not a self-service capability.
- **[OWNER/LEGAL] A-022 — moderation retention promise.** `/privacy` promises a
  moderation copy is kept "mesmo que o conteúdo seja apagado depois." The code now
  makes that true **going forward**; it does not retroactively recover reports
  cascaded away before the migration deploy. Any DSR/erasure runbook must honor
  the surviving `UserReport` rows as a moderation-retention exception.
- **(Optional) A-052** — serve Google avatars via `/_next/image` to stop the
  visitor-IP leak the policy now discloses.

---

## 5. Note on retained data (A-022)

The `UserReport.snapshot` retains only fields the code already writes at report
time (`src/lib/actions/social.ts` `reportContent`): the reported author/user's
public fields, caption, workout name, and bio. Nothing new is collected. The
reporter's identity is **not** retained (FK `SET NULL`, never in the snapshot);
the queue shows "Conta excluída". Confirm this is acceptable for moderation-audit
needs.
