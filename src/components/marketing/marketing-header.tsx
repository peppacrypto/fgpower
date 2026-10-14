import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { GArrow } from "@/components/ui/glyph";

const NAV = [
  { href: "/programs", label: "Programas" },
  { href: "/exercises", label: "Exercícios" },
  { href: "/science", label: "Ciência" },
] as const;

/**
 * The public site's header. Signed in (the landing checks the real session),
 * the right side is one way back into the app — never "Entrar"/"Começar",
 * which would only bounce through /login. The static pages (privacy, terms)
 * always render the signed-out header: /login sends a signed-in user on.
 */
export function MarketingHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    // The header's own background also covers the status-bar inset.
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center">
          <Wordmark />
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-1 text-sm sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-md)] px-3 py-2 font-medium text-muted hover:bg-surface-2 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {signedIn ? (
          <Button size="sm" asChild>
            <Link href="/app/today">
              Abrir o app
              <GArrow />
            </Link>
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login">Começar</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
