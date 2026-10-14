import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Wordmark iconSize={22} />
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/programs" className="hover:text-foreground">
            Programas
          </Link>
          <Link href="/exercises" className="hover:text-foreground">
            Exercícios
          </Link>
          <Link href="/science" className="hover:text-foreground">
            Metodologia científica
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Termos
          </Link>
        </nav>
      </div>
    </footer>
  );
}
