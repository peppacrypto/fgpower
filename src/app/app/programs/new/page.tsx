import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCustomProgram } from "@/lib/actions/programs";
import { PROGRAM_NAME_MAX } from "@/lib/validation/program-builder";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Criar programa" };

async function createAction(formData: FormData) {
  "use server";
  await createCustomProgram(String(formData.get("name") ?? ""));
}

/** "Criar programa": a name, then the builder. "Cancelar" goes back to the shelf. */
export default async function NewProgramPage() {
  // Not the /app layout's check: a client navigation can render this page segment alone.
  await requireUser();
  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-3 sm:px-6 sm:py-10">
      <Link
        href="/app/programs"
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-md)] px-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Programas
      </Link>
      <h1 className="text-display mt-4 text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">Criar programa</h1>
      <p className="mt-1.5 text-[15px] text-muted">Dê um nome. Você adiciona os dias e exercícios em seguida.</p>

      <form action={createAction} className="card mt-6 flex flex-col gap-5 p-5">
        <div>
          <Label htmlFor="name">Nome do programa</Label>
          <Input id="name" name="name" placeholder="Ex.: Meu programa de força" required autoFocus className="mt-2" maxLength={PROGRAM_NAME_MAX} />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost" size="lg">
            <Link href="/app/programs">Cancelar</Link>
          </Button>
          <SubmitButton size="lg" pendingLabel="Criando…">
            Continuar
          </SubmitButton>
        </div>
      </form>

      <p className="mt-6 px-1 text-sm leading-normal text-muted">
        Prefere partir de um pronto? Abra um programa da{" "}
        <Link href="/app/programs" className="font-semibold text-accent hover:underline">
          biblioteca
        </Link>{" "}
        e toque em “Personalizar” — você edita uma cópia sua.
      </p>
    </div>
  );
}
