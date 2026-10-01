import "server-only";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/app-origin";
import { renderEmail } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { REPORT_REASON_LABEL, isReportReason } from "./notification-reports-core";

/**
 * The moderation inbox's signals (decision 15): how many reports wait for an
 * admin (the sidebar's "Admin" pip, Settings' "Painel admin"), and the one
 * e-mail an admin gets when that inbox goes from empty to not empty — never
 * one per report, so a flood of reports is one message.
 */

/** Reports still waiting for an admin. */
export async function countOpenReports(): Promise<number> {
  return prisma.userReport.count({ where: { status: "OPEN" } });
}

/** The addresses in ADMIN_EMAILS (the admin plugin's role alone gets no e-mail). */
export function adminEmailAddresses(): string[] {
  return [
    ...new Set(
      (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
}

/**
 * After a report was filed: when it is the only open one (the inbox was
 * empty), one e-mail to each ADMIN_EMAILS address. Does nothing while e-mail
 * is off (sendEmail answers EMAIL_OFF) or ADMIN_EMAILS is empty. Never throws.
 * `openReports` is counted here unless given. Returns how many e-mails went out.
 */
export async function notifyAdminsOfNewReport(report: { reason: string }, openReports?: number): Promise<number> {
  try {
    const addresses = adminEmailAddresses();
    if (addresses.length === 0) return 0;
    if ((openReports ?? (await countOpenReports())) !== 1) return 0;

    const reason = isReportReason(report.reason) ? REPORT_REASON_LABEL[report.reason] : report.reason;
    const link = appUrl("/admin/reports");
    const { html, text } = renderEmail({
      preheader: `Motivo: ${reason}`,
      kicker: "FGPOWER · Moderação",
      title: "Nova denúncia para revisar",
      blocks: [
        { type: "paragraph", text: `Motivo: ${reason}`, strong: true },
        { type: "paragraph", text: "A fila de denúncias estava vazia. Novas denúncias até você revisar esta não mandam outro e-mail." },
      ],
      cta: { label: "Abrir denúncias", href: link },
      footer: { lines: ["Você recebe porque está em ADMIN_EMAILS."] },
    });
    let sent = 0;
    for (const to of addresses) {
      const result = await sendEmail({ to, subject: "FGPOWER · nova denúncia para revisar", html, text, kind: "ADMIN_REPORT" });
      if (result.ok) sent += 1;
    }
    return sent;
  } catch (err) {
    console.error("Admin report e-mail failed", err);
    return 0;
  }
}
