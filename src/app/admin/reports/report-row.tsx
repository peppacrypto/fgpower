"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveReport } from "@/lib/actions/admin";

export function ReportRow({
  reportId,
  reason,
  details,
  reporterName,
  reportedName,
}: {
  reportId: string;
  reason: string;
  details: string | null;
  reporterName: string;
  reportedName: string | null;
}) {
  const [note, setNote] = useState("");
  const [resolved, setResolved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (resolved) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-border p-4">
      <p className="text-sm font-semibold">{reason}</p>
      <p className="mt-0.5 text-xs text-muted">
        Denunciado por {reporterName}
        {reportedName ? ` · sobre ${reportedName}` : ""}
      </p>
      {details ? <p className="mt-2 text-sm text-foreground/90">{details}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} className="max-w-xs" />
        {(["REVIEWED", "ACTIONED", "DISMISSED"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={status === "ACTIONED" ? "danger" : "outline"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await resolveReport(reportId, status, note);
                setResolved(true);
              })
            }
          >
            {status === "REVIEWED" ? "Revisado" : status === "ACTIONED" ? "Ação tomada" : "Descartar"}
          </Button>
        ))}
      </div>
    </div>
  );
}
