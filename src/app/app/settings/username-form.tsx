"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { claimUsername } from "@/lib/actions/profile";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { publicProfileLabel, USERNAME_RULE } from "@/lib/validation/username";

const LINK = "inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline";

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
            className="flex items-center rounded-l-[var(--radius-md)] border border-r-0 border-field bg-surface-2 px-3 text-sm text-muted"
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
            className="min-w-0 rounded-l-none"
          />
        </div>
        <Button type="submit" disabled={pending || !editing}>
          {pending && editing ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {/* Confirmations only — the URL preview below must not re-announce per keystroke. */}
      <p role="status" aria-live="polite" className="sr-only">
        {justSaved ? "Nome de usuário salvo." : ""}
      </p>

      {error ? (
        <p id="username-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : (
        <div id="username-status" className="mt-2">
          {editing ? (
            <p className="text-[13px] text-muted [overflow-wrap:anywhere]">
              {publicProfileLabel(value.trim() || "seu_usuario", publicOrigin)}
            </p>
          ) : saved && savedUrl ? (
            <div className="flex flex-col gap-1.5">
              {/* "Salvo ✓" sits above the link: side by side, the long
                  URL wraps on a phone and strands the separator. */}
              {justSaved ? <p className="text-[13px] font-medium text-success">Salvo ✓</p> : null}
              <p className="text-[13px] text-foreground [overflow-wrap:anywhere]">
                {publicProfileLabel(saved.toLowerCase(), publicOrigin)}
              </p>
              <p className="-my-1 flex flex-wrap items-center gap-x-5">
                <Link href={`/u/${saved.toLowerCase()}`} className={LINK}>
                  Ver perfil
                </Link>
                <button type="button" onClick={copyLink} className={LINK}>
                  {copied ? "Link copiado ✓" : "Copiar link"}
                </button>
                {canShare ? (
                  <button type="button" onClick={share} className={LINK}>
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
