"use client";

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
          background: "#0b0c0e",
          color: "#f2f3f5",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: offline ? "#f5c14d" : "#ff6b68",
          }}
        >
          {offline ? "Sem conexão" : "Erro"}
        </span>
        <strong style={{ fontSize: "20px" }}>
          {offline ? "Sem sinal agora." : "FGPOWER está fora do ar no momento."}
        </strong>
        <span style={{ color: "#9aa0aa", fontSize: "14px", maxWidth: "22rem" }}>
          {offline
            ? "Seus dados salvos continuam salvos. Tente de novo quando o sinal voltar."
            : "Ocorreu um erro inesperado. Tente de novo em instantes."}
        </span>
        <button
          onClick={() => retry()}
          style={{
            marginTop: "8px",
            background: "#c3ff4d",
            color: "#0e1408",
            border: "none",
            borderRadius: 0,
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.25)",
            padding: "12px 22px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
        {error.digest ? (
          <span style={{ color: "#6f7988", fontSize: "11px", fontFamily: "monospace" }}>ref: {error.digest}</span>
        ) : null}
      </body>
    </html>
  );
}
