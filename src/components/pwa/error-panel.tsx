"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isNetworkError } from "./resume";
import { useOnline } from "./offline-banner";

/**
 * The body of an error boundary. It tells "no signal" apart from a real
 * failure — a rejected fetch while offline must not read as "the app broke" —
 * and always offers a way out, since the installed PWA has no back button.
 */
export function ErrorPanel({
  error,
  retry,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  homeHref: string;
  homeLabel: string;
}) {
  const online = useOnline();
  const offline = isNetworkError(error, online);

  useEffect(() => {
    // Surface to the server/observability in dev; digest links to the server log in prod.
    console.error(error);
  }, [error]);

  // A connectivity failure heals itself: when the signal returns, re-fetch.
  useEffect(() => {
    if (!isNetworkError(error, true)) return;
    const onOnline = () => retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [error, retry]);

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="panel-raised px-5 py-7" role="alert">
        <span
          className={`font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${offline ? "text-warning" : "text-danger"}`}
        >
          {offline ? "Sem conexão" : "Erro"}
        </span>
        <h1 className="text-display mt-2 text-2xl font-extrabold">
          {offline ? "Sem sinal agora." : "Algo saiu do prumo."}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {offline
            ? "Não conseguimos falar com o servidor. O que já estava salvo continua salvo, e as séries do treino ficam guardadas neste aparelho. Assim que o sinal voltar, tentamos de novo sozinhos."
            : "Tivemos um problema ao abrir ou salvar isto. Tente de novo; se o erro continuar, recomece pelo botão de baixo."}
        </p>
        {!offline && error.digest ? <p className="mt-2 font-mono text-[11px] text-muted">ref: {error.digest}</p> : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {/* retry() re-fetches the segment from the server; reset() would only
              re-mount the stale tree (e.g. a workout that was actually saved). */}
          <Button variant="strong" className="sm:flex-1" onClick={() => retry()}>
            Tentar de novo
          </Button>
          {/* A full load, not a soft navigation: it also recovers when the
              error happened on this very route (same URL = boundary not reset). */}
          <Button variant="outline" className="sm:flex-1" asChild>
            <a href={homeHref}>{homeLabel}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
