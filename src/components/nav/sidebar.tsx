import Image from "next/image";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";

/**
 * The desktop sidebar (hidden under `sm`, where the bottom nav takes over).
 * A server component: only the links, which light by the current path, are a
 * client island — no auth client here (signing out lives in Configurações →
 * Dados e conta), so phones don't download and hydrate JS for a panel they
 * never show. The monogram is lazy (not preloaded): it sits in a
 * `display: none` panel on phones, where lazy images never load.
 */
export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 px-4 py-6 sm:flex">
      <Link href="/app/today" className="px-2">
        <span className="inline-flex select-none items-center gap-2.5">
          <Image src="/brand/fgpower-tile.png" alt="FGPOWER" width={30} height={30} className="rounded-[22%]" />
          <span aria-hidden className="text-[17px] font-extrabold tracking-tight text-foreground">
            FG<span className="text-accent-strong">POWER</span>
          </span>
        </span>
      </Link>

      <SidebarNav isAdmin={isAdmin} />
    </aside>
  );
}
