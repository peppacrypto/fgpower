import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/require-user";

/** /t/<token> that was turned off, deleted, hidden by moderation — or never existed. */
export default async function SharedWorkoutNotFound() {
  const signedIn = Boolean(await getCurrentSession());
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <title>Link desativado · FGPOWER</title>
      <meta name="robots" content="noindex, nofollow" />
      <div className="panel-raised px-5 py-7">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">404 · Link</span>
        <h1 className="text-display mt-2 text-2xl font-extrabold">Este link não está mais ativo.</h1>
        <p className="mt-2 text-sm text-muted">O treino pode ter sido removido, ou quem compartilhou desativou o link.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {signedIn ? (
            <Button variant="strong" className="sm:flex-1" asChild>
              <Link href="/app/today">Ir para Hoje</Link>
            </Button>
          ) : (
            <>
              <Button variant="strong" className="sm:flex-1" asChild>
                <Link href="/">Conhecer a FGPOWER</Link>
              </Button>
              <Button variant="outline" className="sm:flex-1" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
