"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { submitDataRequest, type DataRequestState } from "@/lib/actions/data-request";

const KINDS = [
  { value: "ACCESS", label: "Acessar meus dados" },
  { value: "DELETE", label: "Excluir meus dados" },
  { value: "CORRECT", label: "Corrigir meus dados" },
  { value: "PORTABILITY", label: "Portabilidade" },
  { value: "OTHER", label: "Outro" },
] as const;

const initial: DataRequestState = {};

export function DataRequestForm({ defaultEmail, contactEmail }: { defaultEmail: string; contactEmail: string }) {
  const [state, formAction, pending] = useActionState(submitDataRequest, initial);

  if (state.done) {
    return (
      <div className="mt-8 rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm">
        <p className="font-semibold">Pedido registrado.</p>
        <p className="mt-1 text-muted">
          {/* [OWNER/LEGAL: prazo de resposta — placeholder.] */}
          Vamos responder pelo e-mail informado.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-[var(--radius-md)] bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div>
        <Label htmlFor="dr-email">Seu e-mail</Label>
        <Input id="dr-email" name="email" type="email" required defaultValue={defaultEmail} maxLength={254} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="dr-kind">O que você quer</Label>
        <Select id="dr-kind" name="kind" defaultValue="ACCESS" className="mt-1.5">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="dr-message">Detalhes (opcional)</Label>
        <Textarea id="dr-message" name="message" maxLength={2000} rows={4} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar pedido"}</Button>
      {contactEmail ? (
        <p className="text-xs text-muted">
          Ou escreva para <a href={`mailto:${contactEmail}`} className="underline">{contactEmail}</a>.
        </p>
      ) : null}
    </form>
  );
}
