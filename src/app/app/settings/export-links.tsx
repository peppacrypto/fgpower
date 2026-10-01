"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/components/share/share-sheet";
import { OFFLINE_ERROR } from "@/components/social/run-action";
import { LoginAgainLink } from "@/components/social/session-expired";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { cn } from "@/lib/utils/cn";

type Format = "csv" | "json";

const HREF: Record<Format, string> = {
  csv: "/api/account/export?format=csv",
  json: "/api/account/export?format=json",
};

/** "fgpower-treinos-2026-09-28.csv" from the response, else a sensible name. */
function filenameOf(res: Response, format: Format): string {
  const m = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
  return m?.[1] ?? (format === "csv" ? "fgpower-treinos.csv" : "fgpower-dados.json");
}

/**
 * The two export downloads (W-151): "Planilha (CSV)" and "JSON". Real links
 * (they work without JavaScript), fetched here so a failure says why on the
 * page — offline, session gone ("Entrar"), too many in a row — instead of a
 * browser download that failed with no explanation.
 */
export function ExportLinks({ variant = "buttons", className }: { variant?: "buttons" | "inline"; className?: string }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: Format) {
    if (busy) return;
    setBusy(format);
    setError(null);
    try {
      const res = await fetch(HREF[format], { credentials: "same-origin", cache: "no-store" });
      if (res.status === 401) setError(SESSION_EXPIRED_ERROR);
      else if (res.status === 429) setError((await res.text()) || "Muitas exportações seguidas. Tente de novo em alguns minutos.");
      else if (!res.ok) setError("Não foi possível gerar o arquivo agora. Tente de novo.");
      else downloadBlob(await res.blob(), filenameOf(res, format));
    } catch {
      setError(navigator.onLine === false ? OFFLINE_ERROR : "Não foi possível gerar o arquivo agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  const onClick = (format: Format) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    void download(format);
  };

  const errorLine = error ? (
    <p role="alert" className="mt-2 w-full text-xs font-medium text-danger">
      {error === SESSION_EXPIRED_ERROR ? (
        <>
          {error} <LoginAgainLink />
        </>
      ) : (
        error
      )}
    </p>
  ) : null;

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-foreground/85", className)}>
        Antes, baixe seus treinos:{" "}
        <a href={HREF.csv} onClick={onClick("csv")} aria-busy={busy === "csv" || undefined} className="-my-3 inline-block py-3 font-semibold text-accent underline underline-offset-2">
          {busy === "csv" ? "Gerando…" : "Planilha (CSV)"}
        </a>{" "}
        ·{" "}
        <a href={HREF.json} onClick={onClick("json")} aria-busy={busy === "json" || undefined} className="-my-3 inline-block py-3 font-semibold text-accent underline underline-offset-2">
          {busy === "json" ? "Gerando…" : "JSON"}
        </a>
        {errorLine}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button variant="outline" size="sm" asChild>
        <a href={HREF.csv} onClick={onClick("csv")} aria-busy={busy === "csv" || undefined}>
          <Download className="size-4" />
          {busy === "csv" ? "Gerando…" : "Planilha (CSV)"}
        </a>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <a href={HREF.json} onClick={onClick("json")} aria-busy={busy === "json" || undefined}>
          <Download className="size-4" />
          {busy === "json" ? "Gerando…" : "JSON"}
        </a>
      </Button>
      {errorLine}
    </div>
  );
}
