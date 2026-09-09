"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the server/observability in dev; digest links to the server log in prod.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-danger">Erro</span>
      <h1 className="text-display mt-2 text-2xl font-extrabold">Algo saiu do prumo.</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Tivemos um problema ao carregar esta página. Você pode tentar de novo.
      </p>
      {error.digest ? (
        <p className="mt-1 font-mono text-[11px] text-muted">ref: {error.digest}</p>
      ) : null}
      <Button variant="strong" className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
