"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/client-beacon";

// Global error boundary — the last-resort fallback that replaces the root
// layout when it (or its providers) throws. Must render its own <html>/<body>
// and gets none of the global CSS, hence the inline styles.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  // Beacon the "app is down" failure to the server sink (A-048): a root-layout
  // throw is caught by React here, so the window handler never sees it.
  useEffect(() => {
    reportClientError({ source: "boundary", message: error.message, stack: error.stack, digest: error.digest });
  }, [error]);
  return (
    <html lang="pt-BR">
      <head>
        <title>FGPOWER</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8f6",
          color: "#17201b",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: offline ? "#8a6300" : "#b42318",
          }}
        >
          {offline ? "Sem conexão" : "Erro"}
        </span>
        <strong style={{ fontSize: "20px" }}>
          {offline ? "Sem sinal agora." : "FGPOWER está fora do ar no momento."}
        </strong>
        <span style={{ color: "#5e6a63", fontSize: "14px", maxWidth: "22rem" }}>
          {offline
            ? "Seus dados salvos continuam salvos. Tente de novo quando o sinal voltar."
            : "Ocorreu um erro inesperado. Tente de novo em instantes."}
        </span>
        <button
          onClick={() => retry()}
          style={{
            marginTop: "8px",
            background: "#246b4a",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 22px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
        {error.digest ? (
          <span style={{ color: "#5e6a63", fontSize: "12px" }}>ref: {error.digest}</span>
        ) : null}
      </body>
    </html>
  );
}
