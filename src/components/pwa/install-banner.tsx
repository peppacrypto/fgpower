"use client";

import { useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useInstallBannerInset } from "@/components/ui/use-scroll-inset";
import { AddGlyph, SHARE_WHERE, ShareGlyph } from "./install-app-card";
import { closeInstallBanner, getInstallBannerMode, subscribeInstall } from "./install-store";

const serverMode = () => null;

/**
 * iOS's install prompt — "Tenha a FGPOWER na tela inicial" on the first
 * screen, the way Chrome offers to install by itself on Android. Safari has
 * no such prompt (nor an install dialog a page can open), so this one floats
 * on the bottom edge, above the bottom nav where there is one, with the two
 * share-sheet steps in a line.
 *
 * Decides by itself (install.ts, installBannerMode): iOS browsers that can
 * add to the home screen only; never in the installed app, after the install
 * card was closed, within 90 days of its own close, on the live workout,
 * onboarding or admin, nor while an install card is on screen. Client-only:
 * nothing on the server, so it can't mismatch; fixed, so nothing moves when
 * it appears — and its height is reserved at the page's end (globals.css).
 * Mounted once, in the root layout.
 */
export function InstallBanner() {
  const pathname = usePathname();
  const mode = useSyncExternalStore(subscribeInstall, () => getInstallBannerMode(pathname), serverMode);
  if (!mode) return null;
  return <InstallBannerView mode={mode} onClose={() => closeInstallBanner()} />;
}

/** The banner itself, for a given iOS browser. */
export function InstallBannerView({ mode, onClose }: { mode: keyof typeof SHARE_WHERE; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useInstallBannerInset(ref);
  return (
    <aside
      ref={ref}
      aria-label="Instalar o app"
      data-install-banner={mode}
      className="fixed inset-x-0 z-30 rounded-t-[var(--radius-xl)] border border-b-0 border-border bg-surface pl-4 pr-1 pt-3 shadow-[var(--shadow-md)] sm:left-auto sm:right-4 sm:w-[24rem] sm:rounded-[var(--radius-xl)] sm:border-b"
    >
      <div className="flex items-start gap-3">
        {/* The app's tile, as the sidebar shows it: what lands on the home screen. */}
        <Image src="/brand/fgpower-tile.png" alt="" width={40} height={40} className="mt-0.5 size-10 shrink-0 rounded-[22%]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">Tenha a FGPOWER na tela inicial</p>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            Toque em <strong className="font-semibold text-foreground">Compartilhar</strong>
            <ShareGlyph />
            {" "}e escolha <strong className="font-semibold text-foreground">Adicionar à Tela de Início</strong>
            <AddGlyph />
          </p>
          <p className="mt-0.5 text-xs text-muted">{SHARE_WHERE[mode]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
