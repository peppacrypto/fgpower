"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

export function DangerZone() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-border p-4">
        <div>
          <p className="text-sm font-medium">Exportar meus dados</p>
          <p className="text-xs text-muted">Baixe todo o seu histórico de treino em JSON.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/account/export" download>
            <Download className="size-4" />
            Exportar
          </a>
        </Button>
      </div>

      <div className="rounded-[var(--radius-md)] border border-danger/40 bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">Excluir conta</p>
        <p className="mt-0.5 text-xs text-danger/80">
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
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <div className="flex gap-2">
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
                      setError("Sua sessão precisa ser recente para excluir a conta. Entre novamente e tente de novo.");
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
