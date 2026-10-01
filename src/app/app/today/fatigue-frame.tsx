"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/action-sheet";
import { ActionErrorText } from "@/components/social/session-expired";
import { runAction } from "@/components/social/run-action";
import { applyDeload, dismissFatigueSignal, undoDeload } from "@/lib/actions/deload";

/**
 * The fatigue card's frame and its choices (W-128): "Aplicar deload nesta
 * semana" (a tap, then a confirm saying what changes — decision 16: the app
 * never applies one by itself) / "Agora não" on a signal, "Entendi" on a
 * heads-up, "Desfazer" on an applied deload. Closing hides the card at once
 * (this week's signal stays closed on every device); a failure brings it
 * back with the reason. Every outcome is read back from the server (the
 * applied card, the dismissal), so a re-render never undoes what it shows.
 *
 * Today keeps rendering a closed frame (`dismissed`) — as its live region
 * alone — so the re-render right after "Agora não" (the action revalidates
 * Today) neither cuts "Sinal de fadiga fechado" short nor drops the focus,
 * which waits there, where the card was, for the next Tab. After "Aplicar" /
 * "Desfazer" (`arrived`) the card that replaces this one takes the focus: the
 * button pressed is gone.
 */
export function FatigueFrame({
  level,
  enrollmentId,
  weekKey,
  canUndo = false,
  dismissed = false,
  arrived = false,
  children,
}: {
  level: "deload" | "deload-next" | "watch" | "applied";
  enrollmentId: string;
  weekKey: string;
  /** An applied deload with no workout started under it yet. */
  canUndo?: boolean;
  /** This week's signal was closed (read on the server): only the live region is left. */
  dismissed?: boolean;
  /** Today was just reached from "Aplicar deload" / "Desfazer" (?deload=): this card takes the focus. */
  arrived?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [closedHere, setClosedHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"apply" | "undo" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const hidden = dismissed || closedHere;
  const statusRef = useRef<HTMLParagraphElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const focusStatus = useRef(false);

  // Closed here: the focus goes where the card was (its "Agora não" is gone).
  useEffect(() => {
    if (!focusStatus.current) return;
    focusStatus.current = false;
    statusRef.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (arrived) sectionRef.current?.focus({ preventScroll: true });
  }, [arrived]);

  // The same node open or closed (first in both), so the closing is said out loud.
  const status = (
    <p ref={statusRef} role="status" tabIndex={-1} className="sr-only">
      {closedHere ? "Sinal de fadiga fechado nesta semana." : ""}
    </p>
  );
  if (hidden) return <>{status}</>;

  function dismiss() {
    setError(null);
    setClosedHere(true);
    focusStatus.current = true;
    startTransition(async () => {
      const result = await runAction(() => dismissFatigueSignal(enrollmentId, weekKey));
      if (!result.ok) {
        setClosedHere(false);
        setError(result.error);
      }
    });
  }

  function run(kind: "apply" | "undo") {
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      const result = await runAction(() => (kind === "apply" ? applyDeload : undoDeload)(enrollmentId, weekKey));
      if (!result.ok) {
        setBusy(null);
        setConfirming(false);
        setError(result.error);
        return;
      }
      // Today again, with the one-time notice ("Deload aplicado nesta semana.").
      router.replace(`/app/today?deload=${kind === "apply" ? "aplicado" : "desfeito"}`, { scroll: false });
    });
  }

  return (
    <>
      {status}
      <section
        ref={sectionRef}
        tabIndex={-1}
        aria-label={level === "applied" ? "Deload aplicado" : "Sinal de fadiga"}
        data-fatigue={level}
        className="mt-6 border-l-2 border-l-accent bg-surface-2 px-3 py-2.5 outline-none"
      >
        {children}
        {level === "deload" ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setConfirming(true);
                }}
                disabled={pending}
                aria-haspopup="dialog"
                className="h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-left"
              >
                Aplicar deload nesta semana
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} disabled={pending}>
                Agora não
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Treinos já iniciados ficam como estão.</p>
            {confirming ? (
              <ConfirmSheet
                title="Aplicar deload nesta semana?"
                subtitle={
                  <>
                    Os treinos que você começar até domingo abrem com metade das séries, as mesmas cargas e{" "}
                    <span className="whitespace-nowrap">RIR 3-4</span>. Dá para desfazer até o primeiro deles começar.
                  </>
                }
                confirmLabel="Aplicar deload"
                pending={busy === "apply"}
                pendingLabel="Aplicando…"
                onConfirm={() => run("apply")}
                onClose={() => setConfirming(false)}
              />
            ) : null}
          </>
        ) : level === "applied" ? (
          canUndo ? (
            <div className="mt-1.5">
              <Button size="sm" variant="ghost" onClick={() => run("undo")} disabled={pending} className="-ml-3.5">
                {busy === "undo" ? "Desfazendo…" : "Desfazer"}
              </Button>
            </div>
          ) : null
        ) : (
          <div className="mt-1.5">
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={pending} className="-ml-3.5">
              Entendi
            </Button>
          </div>
        )}
        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            <ActionErrorText error={error} />
          </p>
        ) : null}
      </section>
    </>
  );
}
