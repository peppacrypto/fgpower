"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ActionErrorText } from "@/components/social/session-expired";

/**
 * Status line under an autosaving block (Settings, the check-in): "Salvando…" while pending, "Salvo ✓"
 * for a few seconds after each successful save (keyed on `savedAt`, so saving
 * twice flashes twice), or the error, which stays until the next attempt.
 */
export function SaveStatus({
  pending,
  savedAt,
  error,
  idleText,
  className,
}: {
  pending: boolean;
  savedAt?: string | null;
  error?: string | null;
  /** Shown when nothing is happening (e.g. "Salvo automaticamente"). */
  idleText?: string;
  className?: string;
}) {
  let content: React.ReactNode = idleText ? <span className="text-muted">{idleText}</span> : null;
  if (pending) content = <span className="text-muted">Salvando…</span>;
  else if (error)
    content = (
      <span className="text-sm font-medium text-danger">
        <ActionErrorText error={error} />
      </span>
    );
  else if (savedAt) content = <SavedFlash key={savedAt} idleText={idleText} />;

  return (
    <p role="status" aria-live="polite" className={cn("min-h-5 text-[13px] font-medium", className)}>
      {content}
    </p>
  );
}

function SavedFlash({ idleText }: { idleText?: string }) {
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setFresh(false), 3000);
    return () => clearTimeout(t);
  }, []);
  if (fresh) return <span className="text-success">Salvo ✓</span>;
  return idleText ? <span className="text-muted">{idleText}</span> : null;
}
