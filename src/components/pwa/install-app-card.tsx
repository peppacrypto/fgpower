"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { installCardEligible, type InstallMode } from "./install";
import { getInstallMode, getServerInstallMode, promptInstall, rememberInstall, subscribeInstall } from "./install-store";

/** Where the share button lives, per iOS browser (under step 1). */
const SHARE_WHERE: Record<Exclude<InstallMode, "prompt">, string> = {
  "ios-safari": "Na barra do Safari, ou no menu •••",
  "ios-chrome": "Na barra de endereço do Chrome",
  "ios-edge": "No menu ••• do Edge",
  "ios-firefox": "No menu ☰ do Firefox",
};

/**
 * "Tenha a FGPOWER na tela inicial" — the app's one install ask.
 *
 * Decides by itself whether to render; the page only passes how many
 * workouts the user has finished (`finishedWorkouts`, a count of COMPLETED
 * sessions — the summary counts the one just finished). It shows once that
 * reaches INSTALL_CARD_MIN_WORKOUTS, on a phone or tablet, and never:
 * - when already running from the home-screen icon (display-mode standalone,
 *   or iOS navigator.standalone);
 * - after the user closed it or installed the app (this device remembers);
 * - where there is nothing to offer (desktop, in-app browsers, an Android
 *   browser that didn't offer its install dialog).
 *
 * Android/Chromium: one button opens the browser's own install dialog
 * (beforeinstallprompt, stashed by install-store). iOS: two steps through
 * the share sheet. Client-only: it renders nothing on the server and appears
 * after hydration (on Android, whenever the browser offers its dialog), so
 * place it at the end of the page, where nothing below it can shift.
 */
export function InstallAppCard({ finishedWorkouts, className }: { finishedWorkouts: number; className?: string }) {
  const liveMode = useSyncExternalStore(subscribeInstall, getInstallMode, getServerInstallMode);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  if (!installCardEligible(finishedWorkouts)) return null;
  // While the browser's dialog is open the stashed event is already spent:
  // keep the card as it was until the answer comes back.
  const mode: InstallMode | null = installing ? "prompt" : liveMode;
  if (!mode && !installed) return null;

  const install = async () => {
    setInstalling(true);
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      setInstalled(true);
      rememberInstall("installed");
    } else if (outcome === "dismissed") {
      // A no to the browser's own dialog is a no: don't ask again.
      rememberInstall("dismissed");
    }
    setInstalling(false);
  };

  return (
    <div className={className}>
      {/* Mounted empty with the card, filled on acceptance: screen readers
          announce a live region whose text changes, not one inserted full. */}
      <p
        role="status"
        data-install-status
        className={
          installed
            ? "border-l-2 border-l-success bg-surface-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
            : "sr-only"
        }
      >
        {installed ? "App instalado · abra pelo ícone FGPOWER" : ""}
      </p>
      {!installed && mode ? (
        <InstallCardView
          mode={mode}
          installing={installing}
          onInstall={install}
          onDismiss={() => rememberInstall("dismissed")}
        />
      ) : null}
    </div>
  );
}

/** The card itself, for a given mode (no browser access: renders anywhere). */
export function InstallCardView({
  mode,
  installing = false,
  onInstall,
  onDismiss,
  className,
}: {
  mode: InstallMode;
  installing?: boolean;
  onInstall?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const titleId = useId();
  const ios = mode !== "prompt";
  return (
    <section aria-labelledby={titleId} data-install-card={mode} className={cn("reg-frame p-5", className)}>
      <div className="flex items-center gap-2">
        <span className="tag tag--field text-accent">App</span>
        {ios ? <span className="tag tag--spec">2 passos</span> : null}
      </div>
      <h2 id={titleId} className="text-display mt-2 text-xl font-extrabold leading-tight">
        Tenha a FGPOWER na tela inicial
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Abre direto no treino de hoje, em tela cheia, sem procurar a aba do navegador.
      </p>

      {ios ? (
        <>
          <ol className="mt-4 flex flex-col border-y border-border" aria-label="Como adicionar">
            <Step n={1} hint={SHARE_WHERE[mode]}>
              Toque em <strong className="font-semibold">Compartilhar</strong>
              <ShareGlyph />
            </Step>
            <Step n={2} hint="Se não aparecer, role a lista de opções">
              Escolha <strong className="font-semibold">Adicionar à Tela de Início</strong>
              <AddGlyph />
            </Step>
          </ol>
          {/* The steps happen outside the page (share sheet), so the card stays
              up while they're followed; closing it is for good. */}
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" className="-mr-3" onClick={onDismiss}>
              Agora não
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-1">
          <Button variant="strong" className="px-4" onClick={onInstall} disabled={installing}>
            <AddGlyph className="ml-0 translate-y-0 text-current" />
            {installing ? "Abrindo…" : "Instalar app"}
          </Button>
          <Button variant="ghost" className="px-3" onClick={onDismiss} disabled={installing}>
            Agora não
          </Button>
        </div>
      )}
    </section>
  );
}

function Step({ n, hint, children }: { n: number; hint: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-t border-border py-2.5 first:border-t-0">
      <span className="w-5 shrink-0 pt-px font-mono text-xs font-bold leading-5 text-foreground/40" aria-hidden>
        {String(n).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-5">{children}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </li>
  );
}

/** Square-cap keylines in the house glyph style (components/ui/glyph). */
function GlyphBase({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn("ml-1.5 inline-block size-4 shrink-0 -translate-y-px align-middle text-accent", className)}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** iOS's share mark: a tray open at the top, an arrow leaving it. */
function ShareGlyph({ className }: { className?: string }) {
  return (
    <GlyphBase className={className}>
      <polyline points="8,10 5,10 5,21 19,21 19,10 16,10" />
      <line x1="12" y1="3" x2="12" y2="15" />
      <polyline points="8.5,6.5 12,3 15.5,6.5" />
    </GlyphBase>
  );
}

/** A square with a plus — "Adicionar à Tela de Início". */
function AddGlyph({ className }: { className?: string }) {
  return (
    <GlyphBase className={className}>
      <rect x="4" y="4" width="16" height="16" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </GlyphBase>
  );
}
