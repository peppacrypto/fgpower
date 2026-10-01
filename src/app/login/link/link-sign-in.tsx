"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { isBanned, isDeadCode, signInErrorText, type AuthCallError } from "../sign-in-errors";
import { afterSignInHref, emailFromLoginLinkHash, maskEmail, newLinkHref, parseLoginLinkHash, type LoginLink } from "./login-link";

/**
 * The fragment as the page found it. Read once (the page strips it right
 * after, so a reload or a copied URL carries no code) and kept for the
 * page's life: the snapshot must stay the same object between reads.
 */
let captured: { link: LoginLink | null; email: string | null } | null = null;
function readLink() {
  if (!captured) {
    const hash = window.location.hash;
    captured = { link: parseLoginLinkHash(hash), email: emailFromLoginLinkHash(hash) };
  }
  return captured;
}
const noSubscribe = () => () => {};
const serverLink = () => null;

/** "Entrar na FGPOWER · como a•••@gmail.com" [Entrar] — never signs in by itself. */
export function LinkSignIn({ signedIn }: { signedIn: boolean }) {
  const state = useSyncExternalStore(noSubscribe, readLink, serverLink);
  const [pending, setPending] = useState(false);
  // `dead`: the code can't work any more (a new link helps); `final`: nothing will (a suspended account).
  const [error, setError] = useState<{ text: string; dead: boolean; final?: boolean } | null>(null);

  useEffect(() => {
    if (!state) return;
    // The code has done its job in the address bar: out of history and any copy of the URL.
    if (window.location.hash) window.history.replaceState(null, "", "/login/link");
    if (signedIn) window.location.replace(state.link?.next ?? "/app/today");
  }, [state, signedIn]);

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setPending(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (!state || signedIn) {
    // Before hydration (and while an already signed-in visitor moves on).
    return (
      <div aria-busy="true">
        <h1 className="text-xl font-bold tracking-tight">Entrar na FGPOWER</h1>
        <p className="mt-1.5 text-sm text-muted">Abrindo o link…</p>
      </div>
    );
  }

  const link = state.link;
  if (!link || error?.dead) {
    return (
      <div role={error?.dead ? "alert" : undefined}>
        <h1 className="text-xl font-bold tracking-tight">Este link expirou ou já foi usado.</h1>
        <p className="mt-1.5 text-sm text-muted">
          Cada link vale por 10 minutos e funciona uma vez. Peça outro — chega em instantes.
        </p>
        <Button asChild variant="strong" size="lg" className="mt-6 w-full">
          <Link href={newLinkHref(state.email, link?.next ?? null)}>Pedir um novo link</Link>
        </Button>
      </div>
    );
  }

  async function signIn() {
    if (!link) return;
    setPending(true);
    setError(null);
    try {
      const { error: failure } = await authClient.signIn.emailOtp({ email: link.email, otp: link.otp });
      if (!failure) {
        window.location.assign(afterSignInHref(link.next));
        return;
      }
      setError({
        text: signInErrorText(failure as AuthCallError),
        dead: isDeadCode(failure as AuthCallError),
        final: isBanned(failure as AuthCallError),
      });
    } catch {
      setError({ text: signInErrorText(null), dead: false });
    }
    setPending(false);
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Entrar na FGPOWER</h1>
      <p className="mt-1.5 text-sm text-muted [overflow-wrap:anywhere]">
        como <span className="font-semibold text-foreground">{maskEmail(link.email)}</span>
      </p>
      {error?.final ? null : (
        <Button variant="strong" size="lg" className="mt-6 w-full" disabled={pending} onClick={signIn}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      )}
      {error ? (
        <p role="alert" className={cn("text-sm font-medium text-danger", error.final ? "mt-6" : "mt-3")}>
          {error.text}
        </p>
      ) : null}
      {error?.final ? null : (
        <p className="mt-4 text-xs text-muted">Não foi você que pediu? Feche esta página — ninguém entra sem tocar em Entrar.</p>
      )}
    </div>
  );
}
