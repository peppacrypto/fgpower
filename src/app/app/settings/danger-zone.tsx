"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { signOutAction } from "./actions";
import { SignOutRow } from "./sign-out-row";

export function DangerZone() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deleting needs a sign-in from the last 24 h; /login would just bounce a
  // signed-in user back, so the way through is sign out → sign in → here.
  const [needsFreshLogin, setNeedsFreshLogin] = useState(false);

  return (
    // Rows on the section's own panel (no panel inside the panel), the
    // irreversible one last, on its red band.
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Exportar meus dados</p>
          <p className="text-xs text-muted">Baixe todo o seu histórico de treino em JSON.</p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <a href="/api/account/export" download>
            <Download className="size-4" />
            Exportar
          </a>
        </Button>
      </div>

      <div className="border-b border-border py-3">
        <SignOutRow />
      </div>

      <div className="mt-4 border-y-2 border-y-danger bg-danger-soft p-4">
        <p className="text-sm font-semibold text-danger">Excluir conta</p>
        <p className="mt-0.5 text-xs text-foreground/85">
          Remove permanentemente sua conta e todo o seu histórico de treino. Não pode ser desfeito.
        </p>

        {!confirming ? (
          <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirming(true)}>
            <Trash2 className="size-4" />
            Excluir minha conta
          </Button>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-danger">Tem certeza? Isso é permanente.</p>
            {error ? (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : null}
            {needsFreshLogin ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  signOutAction()
                    .catch(() => null)
                    .then(() => window.location.replace("/login?next=%2Fapp%2Fsettings"))
                }
              >
                Sair e entrar de novo
              </Button>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setError(null);
                  const { error: deleteError } = await authClient.deleteUser({});
                  if (deleteError) {
                    if (deleteError.code === "SESSION_EXPIRED") {
                      setNeedsFreshLogin(true);
                      setError("Por segurança, excluir a conta pede um login recente. Saia, entre de novo e volte aqui.");
                    } else {
                      setError(deleteError.message ?? "Não foi possível excluir a conta.");
                    }
                    setDeleting(false);
                    return;
                  }
                  router.push("/");
                }}
              >
                {deleting ? "Excluindo…" : "Sim, excluir permanentemente"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
