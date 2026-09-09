import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-user";
import { Wordmark } from "@/components/brand/logo";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <Wordmark iconSize={24} />
            <span className="rounded-[2px] bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">ADMIN</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted">
            <Link href="/admin/exercises" className="hover:text-foreground">
              Exercícios
            </Link>
            <Link href="/admin/reports" className="hover:text-foreground">
              Denúncias
            </Link>
            <Link href="/app/today" className="hover:text-foreground">
              Voltar ao app
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
