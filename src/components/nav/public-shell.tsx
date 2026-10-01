import Link from "next/link";
import { Logomark } from "@/components/brand/logo";
import { NavHistoryTracker } from "@/components/nav/nav-history";
import { PublicAuthActions } from "@/components/nav/public-auth-actions";

/**
 * The chrome of a public page (a profile, a shared workout) for someone who
 * isn't in the app: signed out, or signed in with the onboarding still to
 * finish. A slim sticky header — the brand back to the landing, and the way
 * in that comes back here — then the page, then a small footer. Signed-in
 * onboarded viewers get the app's shell instead ((public)/layout.tsx).
 */
export function PublicShell({ pendingOnboarding, children }: { pendingOnboarding: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* The header's own background also covers the status-bar inset. */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="FGPOWER — página inicial"
            className="inline-flex min-h-11 shrink-0 select-none items-center gap-2.5"
          >
            <Logomark size={28} alt="" />
            {/* The name from 380px (the Wordmark's lockup); below that the mark alone leaves room for both buttons. */}
            <span aria-hidden className="hidden text-[17px] font-extrabold tracking-tight text-foreground min-[380px]:inline">
              FG<span className="text-accent-strong">POWER</span>
            </span>
          </Link>
          <PublicAuthActions pendingOnboarding={pendingOnboarding} />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 sm:px-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            FGPOWER · Treine com um motivo
          </span>
          <nav aria-label="Rodapé" className="flex items-center gap-1 text-sm text-muted">
            <Link href="/privacy" className="inline-flex min-h-11 items-center px-1.5 hover:text-foreground">
              Privacidade
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center px-1.5 hover:text-foreground">
              Termos
            </Link>
          </nav>
        </div>
      </footer>
      <NavHistoryTracker />
    </div>
  );
}
