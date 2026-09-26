"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { claimUsername } from "@/lib/actions/profile";
import { runAction } from "@/components/social/run-action";
import { INVALID_FIELD, SaveStatus } from "./save-status";

export function UsernameForm({ initialUsername, publicHost }: { initialUsername: string | null; publicHost: string }) {
  const [value, setValue] = useState(initialUsername ?? "");
  const [saved, setSaved] = useState<string | null>(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const attempt = value;
    startTransition(async () => {
      const result = await runAction(() => claimUsername(attempt));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSaved(result.username);
      setValue(result.username);
      setSavedAt(new Date().toISOString());
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && value !== saved) save();
      }}
    >
      <Label htmlFor="username">Nome de usuário público</Label>
      <p className="mt-0.5 text-xs text-muted">
        Aparece no seu perfil público em {publicHost}/u/{value || "seu-usuario"}
      </p>
      <div className="mt-1.5 flex gap-2">
        <Input
          id="username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="seu-usuario"
          maxLength={24}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "username-error" : undefined}
          className={INVALID_FIELD}
        />
        <Button type="submit" disabled={pending || value === saved}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      {error ? (
        <p id="username-error" role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : (
        <SaveStatus pending={false} savedAt={savedAt} className="mt-1.5" />
      )}
    </form>
  );
}
