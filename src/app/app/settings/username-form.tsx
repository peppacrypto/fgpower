"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { claimUsername } from "@/lib/actions/profile";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { publicProfileLabel, USERNAME_RULE } from "@/lib/validation/username";
import { cn } from "@/lib/utils/cn";
import { INVALID_FIELD } from "./save-status";

const MONO = "font-mono text-[11px] font-bold uppercase tracking-[0.12em]";

const noopSubscribe = () => () => {};

export function UsernameForm({ initialUsername, publicOrigin }: { initialUsername: string | null; publicOrigin: string }) {
  const [value, setValue] = useState(initialUsername ?? "");
  const [saved, setSaved] = useState<string | null>(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  function save() {
    const attempt = value.trim().replace(/^@+/, "");
    startTransition(async () => {
      const result = await runAction(() => claimUsername(attempt));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSaved(result.username);
      setValue(result.username);
      setJustSaved(true);
    });
  }

  const savedUrl = saved ? `${publicOrigin}/u/${saved.toLowerCase()}` : null;

  async function copyLink() {
    if (!savedUrl) return;
    try {
      await navigator.clipboard.writeText(savedUrl);
    } catch {
      // Older WebViews / insecure origins: fall back to a selection copy.
      const field = document.createElement("textarea");
      field.value = savedUrl;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function share() {
    if (!savedUrl) return;
    try {
      await navigator.share({ title: "Meu perfil na FGPOWER", url: savedUrl });
    } catch {
      // Dismissed by the user — nothing to do.
    }
  }

  const editing = value.trim() !== (saved ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && editing) save();
      }}
    >
      <Label htmlFor="username">Nome de usuário público</Label>
      <p id="username-rule" className="mt-0.5 text-xs text-muted">
        {USERNAME_RULE} (sem espaços, acentos ou hífen).
      </p>
      <div className="mt-1.5 flex gap-2">
        <div className="flex min-w-0 flex-1">
          <span
            aria-hidden
            className="flex items-center rounded-l-[3px] border border-r-0 border-foreground/50 bg-surface-2 px-3 font-mono text-sm text-muted"
          >
            @
          </span>
          <Input
            id="username"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/^@+/, ""));
              setJustSaved(false);
              if (error) setError(null);
            }}
            placeholder="seu_usuario"
            maxLength={24}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "username-rule username-error" : "username-rule username-status"}
            className={cn("min-w-0 rounded-l-none", INVALID_FIELD)}
          />
        </div>
        <Button type="submit" disabled={pending || !editing}>
          {pending && editing ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {error ? (
        <p id="username-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : (
        <div id="username-status" role="status" aria-live="polite" className="mt-2">
          {editing ? (
            <p className="font-mono text-xs text-muted">
              {publicProfileLabel(value.trim() || "seu_usuario", publicOrigin)}
            </p>
          ) : saved && savedUrl ? (
            <div className="flex flex-col gap-1.5">
              {/* "Salvo ✓" sits above the link: side by side, the long mono
                  URL wraps on a phone and strands the separator. */}
              {justSaved ? <p className={cn(MONO, "text-success")}>Salvo ✓</p> : null}
              <p className="font-mono text-xs text-foreground [overflow-wrap:anywhere]">
                {publicProfileLabel(saved.toLowerCase(), publicOrigin)}
              </p>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link href={`/u/${saved.toLowerCase()}`} className={cn(MONO, "text-accent underline decoration-2 underline-offset-[3px]")}>
                  Ver perfil
                </Link>
                <button type="button" onClick={copyLink} className={cn(MONO, "text-accent underline decoration-2 underline-offset-[3px]")}>
                  {copied ? "Link copiado ✓" : "Copiar link"}
                </button>
                {canShare ? (
                  <button type="button" onClick={share} className={cn(MONO, "text-accent underline decoration-2 underline-offset-[3px]")}>
                    Compartilhar
                  </button>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </form>
  );
}
