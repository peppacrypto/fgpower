"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ googleConfigured }: { googleConfigured: boolean }) {
  const [loading, setLoading] = useState(false);

  if (!googleConfigured) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2 p-4 text-sm text-muted">
        O login com Google ainda não foi configurado neste ambiente. Defina{" "}
        <code className="rounded bg-surface px-1 py-0.5 text-xs">GOOGLE_CLIENT_ID</code> e{" "}
        <code className="rounded bg-surface px-1 py-0.5 text-xs">GOOGLE_CLIENT_SECRET</code>.
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await authClient.signIn.social({
          provider: "google",
          callbackURL: "/app/today",
          newUserCallbackURL: "/onboarding",
          errorCallbackURL: "/login?error=1",
        });
      }}
    >
      <GoogleIcon />
      {loading ? "Redirecionando…" : "Continuar com Google"}
    </Button>
  );
}
