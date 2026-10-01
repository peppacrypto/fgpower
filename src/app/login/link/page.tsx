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
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark iconSize={34} />
        </div>
        <div className="reg-frame p-8">
          <LinkSignIn signedIn={Boolean(session)} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className="hover:text-foreground">
            ← Voltar para a página inicial
          </Link>
        </p>
      </div>
    </div>
  );
}
