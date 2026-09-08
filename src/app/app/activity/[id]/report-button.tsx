"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportContent } from "@/lib/actions/social";

const REASONS = [
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Assédio" },
  { value: "INAPPROPRIATE_CONTENT", label: "Conteúdo inapropriado" },
  { value: "FAKE_DATA", label: "Dados falsos" },
  { value: "OTHER", label: "Outro" },
] as const;

export function ReportButton({ activityId }: { activityId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs text-muted">Denúncia enviada. Obrigado.</span>;
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag className="size-4" />
        Denunciar
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REASONS.map((r) => (
        <button
          key={r.value}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await reportContent({ activityId, reason: r.value });
              setDone(true);
            })
          }
          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-2"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
