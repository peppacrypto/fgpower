import "dotenv/config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

/**
 * A UserReport must OUTLIVE the reporter or the reported user deleting their
 * account (A-022): the FKs are SET NULL (not Cascade), so the report row — with
 * its snapshot evidence — stays in the moderation queue. The admin queue then
 * renders "Conta excluída" for a null reporter, and falls back to the snapshot
 * identity for a null reported user. Real local Postgres; the queue page (an
 * admin RSC) is rendered with its client action-row and next/link stubbed.
 */

const RUN_ID = `rep-${Date.now()}`;

const adminUser = { id: `${RUN_ID}-admin`, name: "Admin", username: "admin", role: "admin", email: `${RUN_ID}-admin@x` };
vi.mock("@/lib/auth/require-user", () => ({ requireAdmin: async () => adminUser }));
vi.mock("next/link", () => ({
  default: (props: { href?: unknown; children?: unknown }) =>
    createElement("a", { href: typeof props.href === "string" ? props.href : "#" }, props.children as never),
}));
// The action row is a client component (useRouter); it is irrelevant to the
// reporter/target derivation under test, so stub it out so the RSC renders.
vi.mock("@/app/admin/reports/report-row", () => ({
  ReportActions: () => null,
  ResolvedActions: () => null,
  ResultNotice: () => null,
}));

const { default: AdminReportsPage } = await import("@/app/admin/reports/page");

const userIds: string[] = [];
const reportIds: string[] = [];

async function makeUser(label: string) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, username: `${label}_${Date.now().toString(36)}`.slice(0, 30) },
  });
  await prisma.profile.create({ data: { userId: id, displayName: label, onboardingCompletedAt: new Date() } });
  userIds.push(id);
  return { id };
}

async function fileReport(data: {
  reporterId: string;
  reportedUserId: string;
  reason: "SPAM" | "HARASSMENT" | "FAKE_DATA";
  snapshot: object;
}) {
  const r = await prisma.userReport.create({ data: { ...data, activityId: null } });
  reportIds.push(r.id);
  return r.id;
}

/** The identity snapshot reportContent keeps for a person report. */
const userSnapshot = (u: { id: string; name: string; username: string }) => ({
  kind: "user",
  user: { id: u.id, name: u.name, username: u.username, image: null, bio: null },
});

afterAll(async () => {
  // Reports no longer cascade with their users (that is the fix under test), so drop them first.
  await prisma.userReport.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("UserReport survives account deletion", () => {
  it("deleting the reporter leaves their reports (reporterId SET NULL), snapshot and status kept", async () => {
    const reporter = await makeUser("reporterA");
    const reported = await makeUser("reportedH");
    const snap = { id: reported.id, name: "reportedH", username: "reportedh" };
    const r1 = await fileReport({ reporterId: reporter.id, reportedUserId: reported.id, reason: "HARASSMENT", snapshot: userSnapshot(snap) });
    const r2 = await fileReport({ reporterId: reporter.id, reportedUserId: reported.id, reason: "SPAM", snapshot: userSnapshot(snap) });

    await prisma.user.delete({ where: { id: reporter.id } });
    userIds.splice(userIds.indexOf(reporter.id), 1);

    const rows = await prisma.userReport.findMany({ where: { id: { in: [r1, r2] } } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.reporterId).toBeNull();
      expect(row.reportedUserId).toBe(reported.id);
      expect(row.status).toBe("OPEN");
      expect((row.snapshot as { user?: { name?: string } })?.user?.name).toBe("reportedH");
    }
  });

  it("deleting the reported user leaves the report (reportedUserId SET NULL), the snapshot keeps the identity", async () => {
    const reporter = await makeUser("reporterR2");
    const reported = await makeUser("reportedH2");
    const r = await fileReport({
      reporterId: reporter.id,
      reportedUserId: reported.id,
      reason: "SPAM",
      snapshot: userSnapshot({ id: reported.id, name: "reportedH2", username: "reportedh2" }),
    });

    await prisma.user.delete({ where: { id: reported.id } });
    userIds.splice(userIds.indexOf(reported.id), 1);

    const row = await prisma.userReport.findUniqueOrThrow({ where: { id: r } });
    expect(row.reportedUserId).toBeNull();
    expect(row.reporterId).toBe(reporter.id);
    expect(row.status).toBe("OPEN");
    expect((row.snapshot as { user?: { name?: string } })?.user?.name).toBe("reportedH2");
  });
});

describe("admin queue render", () => {
  /** The rendered HTML of one report card (scoped by its data-report id). */
  function cardOf(html: string, reportId: string): string {
    const marker = `data-report="${reportId}"`;
    const start = html.lastIndexOf("<li", html.indexOf(marker));
    if (start === -1) return "";
    const next = html.indexOf("<li", start + 1);
    return html.slice(start, next === -1 ? undefined : next);
  }

  it("shows 'Conta excluída' for a null reporter, and the snapshot identity for a null reported user", async () => {
    // A report whose reporter deleted their account; the reported user is still present.
    const goneReporter = await makeUser("goneReporter");
    const stillReported = await makeUser("stillReported");
    const nullReporterReport = await fileReport({
      reporterId: goneReporter.id,
      reportedUserId: stillReported.id,
      reason: "HARASSMENT",
      snapshot: userSnapshot({ id: stillReported.id, name: "stillReported", username: "stillreported" }),
    });
    await prisma.user.delete({ where: { id: goneReporter.id } });
    userIds.splice(userIds.indexOf(goneReporter.id), 1);

    // A report whose reported user deleted their account; the reporter is still present.
    const stillReporter = await makeUser("stillReporter");
    const goneReported = await makeUser("goneReported");
    const nullReportedReport = await fileReport({
      reporterId: stillReporter.id,
      reportedUserId: goneReported.id,
      reason: "SPAM",
      snapshot: userSnapshot({ id: goneReported.id, name: "Alvo no snapshot", username: "alvosnap" }),
    });
    await prisma.user.delete({ where: { id: goneReported.id } });
    userIds.splice(userIds.indexOf(goneReported.id), 1);

    const element = await AdminReportsPage({ searchParams: Promise.resolve({}) } as never);
    const html = renderToStaticMarkup(element as never);

    // Null reporter → "Conta excluída"; the reported user that is still there shows.
    const cardA = cardOf(html, nullReporterReport);
    expect(cardA).not.toBe("");
    expect(cardA).toContain("Conta excluída");
    expect(cardA).toContain("stillReported");

    // Null reported user → no "Conta excluída" for the reporter; target from the snapshot.
    const cardB = cardOf(html, nullReportedReport);
    expect(cardB).not.toBe("");
    expect(cardB).toContain("stillReporter");
    expect(cardB).toContain("Alvo no snapshot");
    expect(cardB).not.toContain("Conta excluída");
  });
});
