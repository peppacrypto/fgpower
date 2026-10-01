import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-user";
import { Wordmark } from "@/components/brand/logo";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link href="/admin" className="flex items-center gap-3">
            <Wordmark iconSize={24} />
            <span className="rounded-[2px] bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">ADMIN</span>
          </Link>
          <nav className="flex flex-wrap gap-x-4 text-sm text-muted">
            <Link href="/admin/exercises" className="inline-flex min-h-11 items-center hover:text-foreground">
              Exercícios
            </Link>
            <Link href="/admin/reports" className="inline-flex min-h-11 items-center hover:text-foreground">
              Denúncias
            </Link>
            <Link href="/app/today" className="inline-flex min-h-11 items-center hover:text-foreground">
              Voltar ao app
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
