import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/programs", label: "Programas" },
  { href: "/exercises", label: "Exercícios" },
  { href: "/science", label: "Ciência" },
] as const;

export function MarketingHeader({ onDark = false }: { onDark?: boolean }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur",
        onDark ? "border-white/10 bg-black/60" : "border-border bg-background/85",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/">
          <Wordmark onDark={onDark} />
        </Link>
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-2",
                onDark
                  ? "text-white/60 hover:bg-white/10 hover:text-white"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={onDark ? "text-white hover:bg-white/10" : ""}
          >
            <Link href="/login">Entrar</Link>
          </Button>
          <Button variant="strong" size="sm" asChild>
            <Link href="/login">Começar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
