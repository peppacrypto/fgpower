"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/** Danger border + ring for an input carrying aria-invalid="true". */
export const INVALID_FIELD =
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger";

const MONO = "font-mono text-[11px] font-bold uppercase tracking-[0.14em]";

/**
 * Status line under a Settings block: "SALVANDO…" while pending, "SALVO ✓"
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
  else if (error) content = <span className="font-sans text-sm font-medium normal-case tracking-normal text-danger">{error}</span>;
  else if (savedAt) content = <SavedFlash key={savedAt} idleText={idleText} />;

  return (
    <p role="status" aria-live="polite" className={cn("min-h-4", MONO, className)}>
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
