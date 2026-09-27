import Link from "next/link";
import type { Route } from "next";
import { Button } from "./button";

/** The page title of every 404 (metadata fallbacks use it too, so no two <title>s disagree). */
export const NOT_FOUND_TITLE = "Página não encontrada";

/**
 * The 404 body shared by the root and /app not-found pages: a mono dossier
 * code, a plain-language headline and two ways back in (the installed PWA has
 * no browser back button).
 */
export function NotFoundPanel({ programsHref }: { programsHref: Route }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      {/* The not-found `metadata` export only applies to unmatched URLs at the
          root; a page calling notFound() keeps the layout's default title.
          React inserts this <title> ahead of the head's first one, so it is
          the document title either way (the default's tag stays behind it). */}
      <title>{`${NOT_FOUND_TITLE} · FGPOWER`}</title>
      <div className="panel-raised px-5 py-7">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
          404 · Fora do mapa
        </span>
        <h1 className="text-display mt-2 text-2xl font-extrabold">Esta página não existe (ou saiu do ar).</h1>
        <p className="mt-2 text-sm text-muted">
          O link pode estar velho, o treino ou programa pode ter sido excluído, ou o endereço veio com um erro de
          digitação.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button variant="strong" className="sm:flex-1" asChild>
            <Link href="/app/today">Ir para Hoje</Link>
          </Button>
          <Button variant="outline" className="sm:flex-1" asChild>
            <Link href={programsHref}>Ver programas</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
