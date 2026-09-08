import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Wordmark iconSize={22} />
        <div className="flex flex-wrap gap-4">
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
        </div>
      </div>
    </footer>
  );
}
