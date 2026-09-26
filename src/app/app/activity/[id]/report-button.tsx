"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportContent } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";

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
  const [error, setError] = useState<string | null>(null);
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
              setError(null);
              const result = await runAction(() => reportContent({ activityId, reason: r.value }));
              if (result.ok) setDone(true);
              else setError(result.error);
            })
          }
          className="rounded-[2px] border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-2"
        >
          {r.label}
        </button>
      ))}
      {error ? (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
