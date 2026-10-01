import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/require-user";
import { Button } from "@/components/ui/button";

/**
 * /u/<handle> that doesn't exist or isn't visible to this viewer. Signed in,
 * it offers ways back into the app; signed out, a way in. The page's
 * generateMetadata titles it like every 404 ("Página não encontrada").
 */
export default async function ProfileNotFound() {
  const signedIn = Boolean(await getCurrentSession());
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="panel-raised px-5 py-7">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">404 · Perfil</span>
        <h1 className="text-display mt-2 text-2xl font-extrabold">Perfil não encontrado ou publicação privada.</h1>
        <p className="mt-2 text-sm text-muted">
          {signedIn
            ? "O @usuário pode ter mudado, ou o perfil só aparece para quem segue."
            : "O @usuário pode ter mudado, ou o perfil só aparece para quem segue. Entre para ver o que é seu e de quem você segue."}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {signedIn ? (
            <>
              <Button variant="strong" className="sm:flex-1" asChild>
                <Link href="/app/today">Ir para Hoje</Link>
              </Button>
              <Button variant="outline" className="sm:flex-1" asChild>
                <Link href="/app/discover">Descobrir pessoas</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="strong" className="sm:flex-1" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button variant="outline" className="sm:flex-1" asChild>
                <Link href="/">Início</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
