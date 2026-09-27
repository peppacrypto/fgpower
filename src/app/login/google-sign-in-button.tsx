"use client";

import { useEffect, useState } from "react";
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

/** Where Google sends the user back, keeping `next` through every branch. */
function callbackUrls(next: string | null | undefined) {
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);
  return {
    callbackURL: next ?? "/app/today",
    // New accounts onboard first, then the wizard continues to `next` (a
    // sign-in restarted mid-wizard already points there).
    newUserCallbackURL: next?.startsWith("/onboarding") ? next : withNext("/onboarding"),
    // better-auth appends `error=<code>`; /login turns it into a message.
    errorCallbackURL: withNext("/login"),
  };
}

export function GoogleSignInButton({ googleConfigured, next }: { googleConfigured: boolean; next?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coming back from Google with the browser's back button restores this page
  // from the back/forward cache, still saying "Redirecionando…".
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setLoading(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (!googleConfigured) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2 p-4 text-sm text-muted">
        O login com Google ainda não foi configurado neste ambiente. Defina{" "}
        <code className="rounded bg-surface px-1 py-0.5 text-xs">GOOGLE_CLIENT_ID</code> e{" "}
        <code className="rounded bg-surface px-1 py-0.5 text-xs">GOOGLE_CLIENT_SECRET</code>.
      </div>
    );
  }

  async function signIn() {
    setLoading(true);
    setError(null);
    const failed = () => {
      setLoading(false);
      setError(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "Sem conexão. Tente de novo quando o sinal voltar."
          : "Não foi possível abrir o login do Google. Tente de novo.",
      );
    };
    try {
      // `next` was validated server-side (safeNextPath): an app path only.
      const result = await authClient.signIn.social({ provider: "google", ...callbackUrls(next) });
      // On success the browser is already leaving for Google; keep "Redirecionando…".
      if (result?.error) failed();
    } catch {
      failed();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="lg" className="w-full" disabled={loading} onClick={signIn}>
        <GoogleIcon />
        {loading ? "Redirecionando…" : "Continuar com Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
