import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import * as z from "zod";
import { Wordmark } from "@/components/brand/logo";
import { getCurrentSession } from "@/lib/auth/require-user";
import { safeNextPath } from "@/lib/auth/safe-next";
import { SESSION_EXPIRED_PARAM, SESSION_EXPIRED_VALUE } from "@/lib/auth/session-expired";
import { emailEnabled } from "@/lib/email/config";
import { EmailSignIn } from "./email-sign-in";
import { GoogleSignInButton } from "./google-sign-in-button";
import { oauthErrorView } from "./sign-in-errors";

/** `?email=` (the link page's "Pedir um novo link"): prefilled only when it is an address. */
function prefillEmail(value: string | string[] | undefined): string | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
  return raw && raw.length <= 254 && z.email().safeParse(raw).success ? raw : null;
}

/**
 * Google, and — only while e-mail is configured (lib/email/config; off in
 * production until Resend exists) — a link + code by e-mail. Off, the page
 * is Google alone: no disabled form, no "em breve".
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const session = await getCurrentSession();
  if (session) {
    redirect(next ?? "/app/today");
  }
  // A failed Google sign-in (better-auth's `?error=`): cancelled, suspended, or anything else.
  const oauthError = oauthErrorView(Array.isArray(sp.error) ? sp.error[0] : sp.error);
  const sessionExpired = sp[SESSION_EXPIRED_PARAM] === SESSION_EXPIRED_VALUE;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark iconSize={34} />
        </div>

        <div className="reg-frame">
          {/* Brand banner — full art, never cropped */}
          <div className="relative overflow-hidden rounded-t-[3px]">
            <Image
              src="/brand/fg-banner-letlive.webp"
              alt="Same weights, different you — FGPOWER"
              width={1920}
              height={641}
              className="h-auto w-full select-none"
              // The page's largest paint: fetched from the <head>. (`priority` is deprecated in Next 16.)
              preload
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          </div>

          <div className="p-8">
            <h1 className="text-xl font-bold tracking-tight">Entrar na FGPOWER</h1>
            <p className="mt-1.5 text-sm text-muted">
              Sua conta e seu histórico de treino ficam salvos automaticamente.
            </p>

            {oauthError ? (
              <div role="alert" className="mt-5 border-l-2 border-l-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                <p className="font-medium">{oauthError.text}</p>
                {oauthError.code ? (
                  <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
                    Código: {oauthError.code}
                  </p>
                ) : null}
              </div>
            ) : sessionExpired ? (
              <p role="status" className="mt-5 border-l-2 border-l-accent bg-surface-2 px-3.5 py-2.5 text-sm">
                <span className="font-semibold">Sua sessão expirou.</span> Entre de novo para continuar de onde parou.
              </p>
            ) : null}

            <div className="mt-6">
              <GoogleSignInButton googleConfigured={Boolean(process.env.GOOGLE_CLIENT_ID)} next={next} />
            </div>

            {emailEnabled() ? (
              <>
                <div className="my-5 flex items-center gap-3" role="separator" aria-label="ou">
                  <span aria-hidden className="h-px flex-1 bg-border" />
                  <span aria-hidden className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                    ou
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </div>
                <EmailSignIn next={next} initialEmail={prefillEmail(sp.email)} />
              </>
            ) : null}

            <p className="mt-6 text-center text-xs text-muted">
              Ao continuar, você concorda com os{" "}
              <Link href="/terms" className="underline hover:text-foreground">
                Termos
              </Link>{" "}
              e a{" "}
              <Link href="/privacy" className="underline hover:text-foreground">
                Política de Privacidade
              </Link>
              . A FGPOWER não é um serviço de diagnóstico médico.
            </p>
          </div>
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
