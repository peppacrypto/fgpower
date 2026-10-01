"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * The public header's buttons. Signed out: "Entrar" and "Criar conta", both
 * coming back to this page after signing in. Signed in without a finished
 * onboarding: "Concluir cadastro", which also comes back here.
 */
export function PublicAuthActions({ pendingOnboarding }: { pendingOnboarding: boolean }) {
  const next = encodeURIComponent(usePathname());
  if (pendingOnboarding) {
    return (
      <Button variant="strong" size="sm" asChild>
        <Link href={`/onboarding?next=${next}`}>Concluir cadastro</Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/login?next=${next}`}>Entrar</Link>
      </Button>
      <Button variant="strong" size="sm" asChild>
        <Link href={`/login?next=${next}`}>Criar conta</Link>
      </Button>
    </div>
  );
}
