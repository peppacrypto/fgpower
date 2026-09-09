"use client";

// Global error boundary — the last-resort fallback that replaces the root
// layout when it (or its providers) throws. Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
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
          background: "#0a0a0b",
          color: "#f2f3f5",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <strong style={{ fontSize: "20px" }}>FGPOWER está fora do ar no momento.</strong>
        <span style={{ color: "#9aa0aa", fontSize: "14px" }}>
          Ocorreu um erro inesperado. Tente recarregar a página.
        </span>
        <button
          onClick={reset}
          style={{
            marginTop: "8px",
            background: "#b4e600",
            color: "#14210a",
            border: "none",
            padding: "10px 20px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
        {error.digest ? (
          <span style={{ color: "#6f7988", fontSize: "11px", fontFamily: "monospace" }}>
            ref: {error.digest}
          </span>
        ) : null}
      </body>
    </html>
  );
}
