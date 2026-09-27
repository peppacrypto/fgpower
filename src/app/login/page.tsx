import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { getCurrentSession } from "@/lib/auth/require-user";
import { safeNextPath } from "@/lib/auth/safe-next";
import { SESSION_EXPIRED_PARAM, SESSION_EXPIRED_VALUE } from "@/lib/auth/session-expired";
import { GoogleSignInButton } from "./google-sign-in-button";

/**
 * better-auth sends failed Google sign-ins back here with `?error=<code>`:
 * `access_denied` when the user backs out of Google's consent screen.
 */
function oauthErrorText(code: string) {
  if (code === "access_denied") return "O login com o Google foi cancelado. Tente de novo quando quiser.";
  return "Não foi possível entrar com o Google. Tente de novo em instantes.";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const session = await getCurrentSession();
  if (session) {
    redirect(next ?? "/app/today");
  }
  const rawError = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  // Codes are short snake_case; anything else is shown as a generic failure.
  const errorCode = rawError ? (/^[a-z0-9_]{1,64}$/.test(rawError) ? rawError : "erro") : null;
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
              priority
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          </div>

          <div className="p-8">
            <h1 className="text-xl font-bold tracking-tight">Entrar na FGPOWER</h1>
            <p className="mt-1.5 text-sm text-muted">
              Sua conta e seu histórico de treino ficam salvos automaticamente.
            </p>

            {errorCode ? (
              <div role="alert" className="mt-5 border-l-2 border-l-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                <p className="font-medium">{oauthErrorText(errorCode)}</p>
                {errorCode !== "access_denied" ? (
                  <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
                    Código: {errorCode}
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
