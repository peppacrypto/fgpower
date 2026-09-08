import Link from "next/link";
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Wordmark iconSize={36} />
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-8">
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

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className="hover:text-foreground">
            ← Voltar para a página inicial
          </Link>
        </p>
      </div>
    </div>
  );
}
