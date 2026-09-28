"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { profileHref } from "@/lib/social/links";
import { cn } from "@/lib/utils/cn";
import { shareLink } from "./share-sheet";

/**
 * "Compartilhar perfil" — the one way to send your profile link, everywhere
 * (your profile, Descobrir's invite, Today's team strip). Web Share where
 * there is one ("Me segue na FGPOWER:" + the link), else the link is copied.
 * The label never changes (people and tests find it by name); what happened
 * is said on the status line under it.
 */
export function ShareProfileButton({
  username,
  name,
  url,
  label = "Compartilhar perfil",
  variant = "outline",
  size = "sm",
  className,
}: {
  username: string;
  /** Display name, for the share sheet's title ("Ana na FGPOWER"). */
  name: string;
  /** Absolute profile URL; defaults to this origin's /u/<username>. */
  url?: string;
  label?: string;
  variant?: "outline" | "ghost" | "secondary" | "strong" | "primary";
  size?: "sm" | "md";
  className?: string;
}) {
  const [status, setStatus] = useState<{ kind: "copied" } | { kind: "failed"; link: string } | null>(null);

  async function share() {
    const link = url ?? `${window.location.origin}${profileHref(username)}`;
    setStatus(null);
    const outcome = await shareLink({ title: `${name} na FGPOWER`, text: "Me segue na FGPOWER:", url: link });
    if (outcome === "copied") setStatus({ kind: "copied" });
    else if (outcome === "failed") setStatus({ kind: "failed", link });
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <Button type="button" variant={variant} size={size} onClick={share}>
        <Share2 aria-hidden />
        {label}
      </Button>
      <p role="status" className={status?.kind === "copied" ? "font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-success" : "sr-only"}>
        {status?.kind === "copied" ? "Link do perfil copiado" : ""}
      </p>
      {status?.kind === "failed" ? (
        <p className="text-xs text-muted">
          Não deu para copiar — segure o link para copiar:{" "}
          <span className="select-all break-all font-mono text-foreground">{status.link}</span>
        </p>
      ) : null}
    </div>
  );
}
