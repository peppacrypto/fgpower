import type { Metadata } from "next";
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
import { oauthErrorView, BANNED_TEXT } from "./sign-in-errors";

export const metadata: Metadata = { title: "Entrar" };

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
      <main className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark iconSize={34} />
        </div>

        <div className="card overflow-hidden rounded-[var(--radius-xl)]">
          {/* Brand banner — full art, never cropped */}
          <div className="relative">
            <Image
              src="/brand/fg-banner-letlive.webp"
              alt="Same weights, different you — FGPOWER"
              width={1920}
              height={641}
              // Full-width inside a max-w-md (448px) column. Without `sizes`,
              // Next serves a 1x/2x density srcSet and every device downloads
              // the 1920px variant (~175 KB); with it, a phone picks w=1200
              // (~76 KB). Does not crop the art (A-090).
              sizes="(max-width: 480px) 100vw, 448px"
              className="h-auto w-full select-none"
              // The page's largest paint: fetched from the <head>. (`priority` is deprecated in Next 16.)
              preload
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          </div>

          <div className="px-6 pb-7 pt-5 sm:px-8 sm:pb-8">
            <h1 className="text-display text-2xl font-semibold">Entrar na FGPOWER</h1>
            <p className="mt-1.5 text-sm text-muted">
              Sua conta e seu histórico de treino ficam salvos automaticamente.
            </p>

            {oauthError ? (
              <div role="alert" className="mt-5 rounded-[var(--radius-md)] bg-danger-soft px-4 py-3 text-sm text-danger">
                <p className="font-medium">{oauthError.text}</p>
                {oauthError.code ? (
                  <p className="mt-1 text-xs opacity-80">
                    Código: {oauthError.code}
                  </p>
                ) : null}
                {/* A-009 — a suspended user must still reach their own data (art. 18 §3). */}
                {oauthError.text === BANNED_TEXT ? (
                  <p className="mt-2 font-normal text-foreground/85">
                    Você ainda pode acessar ou excluir seus dados em{" "}
                    <Link href="/privacidade/solicitar" className="font-semibold underline underline-offset-2">
                      Solicitar meus dados
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            ) : sessionExpired ? (
              <p role="status" className="mt-5 rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm">
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
                  <span aria-hidden className="text-[13px] text-muted">
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
      </main>
    </div>
  );
}
