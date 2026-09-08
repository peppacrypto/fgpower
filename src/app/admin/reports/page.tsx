import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ReportRow } from "./report-row";

export const metadata: Metadata = { title: "Admin · Denúncias" };

const REASON_LABEL: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Assédio",
  INAPPROPRIATE_CONTENT: "Conteúdo inapropriado",
  FAKE_DATA: "Dados falsos",
  OTHER: "Outro",
};

export default async function AdminReportsPage() {
  const reports = await prisma.userReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { name: true } },
      reportedUser: { select: { name: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Denúncias abertas</h1>
      {reports.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nenhuma denúncia aberta.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              reportId={r.id}
              reason={REASON_LABEL[r.reason] ?? r.reason}
              details={r.details}
              reporterName={r.reporter.name}
              reportedName={r.reportedUser?.name ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
