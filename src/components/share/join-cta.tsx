import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GArrow } from "@/components/ui/glyph";

/**
 * The way in for someone who opened a shared workout without an account:
 * sign up (and land back on the same link) or meet the app first.
 */
export function JoinCta({
  name,
  handle,
  returnTo,
  sessionEnded = false,
  loginAgainHref,
}: {
  name: string;
  handle: string | null;
  /** The page to come back to after signing up (/t/<token>). */
  returnTo: string;
  /** The browser still held a session cookie that no longer works. */
  sessionEnded?: boolean;
  loginAgainHref?: string;
}) {
  return (
    <section className="relative mt-6 overflow-hidden panel-raised" aria-labelledby="join-cta-title">
      <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
      <div className="p-5 pl-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">FGPOWER · Grátis · sem cartão</p>
        <h2 id="join-cta-title" className="text-display mt-1.5 text-2xl font-extrabold wrap-break-word">
          Treine com {handle ? `@${handle}` : name} na FGPOWER
        </h2>
        <p className="mt-2 text-sm text-muted">
          Programas com base em evidência, cada série registrada e a carga da próxima vez sugerida pra você.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {sessionEnded && loginAgainHref ? (
            <Button variant="strong" asChild>
              <Link href={loginAgainHref}>Entrar de novo</Link>
            </Button>
          ) : (
            <Button variant="strong" asChild>
              <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>
                Criar conta grátis
                <GArrow className="size-4" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link href="/">Conhecer a FGPOWER</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
