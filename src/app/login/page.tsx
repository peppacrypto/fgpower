import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { getCurrentSession } from "@/lib/auth/require-user";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/app/today");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark iconSize={34} />
        </div>

        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-md">
          {/* Brand banner — full art, never cropped */}
          <div className="relative">
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

            <div className="mt-6">
              <GoogleSignInButton googleConfigured={Boolean(process.env.GOOGLE_CLIENT_ID)} />
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
