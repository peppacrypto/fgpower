"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { claimUsername } from "@/lib/actions/profile";

export function UsernameForm({ initialUsername }: { initialUsername: string | null }) {
  const [value, setValue] = useState(initialUsername ?? "");
  const [saved, setSaved] = useState<string | null>(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <Label htmlFor="username">Nome de usuário público</Label>
      <p className="mt-0.5 text-xs text-muted">
        Aparece no seu perfil público em fgpower.app/u/{value || "seu-usuario"}
      </p>
      <div className="mt-1.5 flex gap-2">
        <Input
          id="username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="seu-usuario"
          maxLength={24}
        />
        <Button
          type="button"
          disabled={pending || value === saved}
          onClick={() =>
            startTransition(async () => {
              const result = await claimUsername(value);
              if (result.error) setError(result.error);
              else {
                setError(null);
                setSaved(value);
              }
            })
          }
        >
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
