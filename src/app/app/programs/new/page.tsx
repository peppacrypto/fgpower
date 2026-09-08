import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/logo";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCustomProgram } from "@/lib/actions/programs";

export const metadata: Metadata = { title: "Criar programa" };

async function createAction(formData: FormData) {
  "use server";
  await createCustomProgram(String(formData.get("name") ?? ""));
}

export default function NewProgramPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <Wordmark iconSize={28} className="mb-8" />
      <h1 className="text-xl font-bold tracking-tight">Criar programa</h1>
      <p className="mt-1 text-sm text-muted">Dê um nome. Você adiciona os dias e exercícios em seguida.</p>

      <form action={createAction} className="mt-6 flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Nome do programa</Label>
          <Input id="name" name="name" placeholder="Ex.: Meu programa de força" required autoFocus className="mt-1.5" maxLength={80} />
        </div>
        <Button type="submit" size="lg">
          Continuar
        </Button>
      </form>
    </div>
  );
}
