import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { getCurrentSession } from "@/lib/auth/require-user";
import { emailEnabled } from "@/lib/email/config";
import { LinkSignIn } from "./link-sign-in";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Per request, never prerendered (A-043). This page redirects on the build-time
 * read emailEnabled() BEFORE any dynamic API, so with e-mail off at build (prod
 * today) it could be baked as a static redirect to /login — which turning Resend
 * on by env alone would not undo, breaking the magic-link landing. Forcing
 * dynamic evaluates emailEnabled() every request. (Cache Components is off, so
 * this route-segment-config opt-out is honored.)
 */
export const dynamic = "force-dynamic";

/**
 * The sign-in e-mail's link lands here (W-065): the address and the code
 * travel in the fragment (never sent to the server), and signing in takes a
 * tap on "Entrar" — a POST, so a mail scanner that opens the link can't use
 * it up, and nobody is signed in by merely opening a URL. With e-mail off
 * (an old link after Resend was turned off) its "Entrar" could never work:
 * the login page instead.
 */
export default async function LoginLinkPage() {
  if (!emailEnabled()) redirect("/login");
  const session = await getCurrentSession();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <main className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark iconSize={34} />
        </div>
        <div className="card rounded-[var(--radius-xl)] px-6 py-7 sm:p-8">
          <LinkSignIn signedIn={Boolean(session)} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className="hover:text-foreground">
            ← Voltar para a página inicial
          </Link>
        </p>
      </main>
    </div>
  );
}
