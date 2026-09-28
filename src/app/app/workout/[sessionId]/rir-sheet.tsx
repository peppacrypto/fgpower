"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatRir } from "@/lib/utils/format";

const SCALE: { rir: number; meaning: string }[] = [
  { rir: 0, meaning: "Falha: não sairia mais nenhuma" },
  { rir: 1, meaning: "Sairia só mais 1" },
  { rir: 2, meaning: "Sairiam mais 2" },
  { rir: 3, meaning: "Sairiam mais 3" },
  { rir: 4, meaning: "4 ou mais — ainda está leve" },
];

/**
 * How a set at this RIR ends, to follow "faria ~12×": "com ~2 reps sobrando",
 * "com 2–3 reps sobrando" (RIR 2,5), "até a falha" (RIR 0). `short` leaves
 * out the word "reps" when the sentence already says it ("Faça ~12 reps com
 * ~2 sobrando").
 */
export function rirSpareWords(rir: number, short = false): string {
  if (rir < 0.5) return "até a falha";
  if (!Number.isInteger(rir)) return `com ${Math.floor(rir)}–${Math.ceil(rir)}${short ? "" : " reps"} sobrando`;
  return `com ~${rir}${short ? "" : rir === 1 ? " rep" : " reps"} sobrando`;
}

/**
 * Whether a level of the scale is the exercise's target: RIR 2,5 marks 2 and
 * 3; the last level ("4 ou mais") is the target of RIR 4 and above (deloads
 * prescribe 5).
 */
export function isRirTarget(level: number, target: number | null): boolean {
  if (target === null) return false;
  const last = SCALE[SCALE.length - 1].rir;
  return level === last ? target >= last - 0.5 : Math.abs(level - target) < 1;
}

/**
 * What RIR means, where the user meets it (the exercise's "RIR 2" and the set
 * table's RIR column): the 0–4 scale with this exercise's target marked, and
 * the way to the full explanation (/app/science/rir).
 */
export function RirSheet({
  target,
  rirDrivesLoad,
  onClose,
}: {
  /** This exercise's RIR target, when it has one. */
  target: number | null;
  /** The exercise progresses by RIR: next time's load comes from the RIR logged. */
  rirDrivesLoad: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  const isTarget = (rir: number) => isRirTarget(rir, target);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rir-title"
        onClick={(e) => e.stopPropagation()}
        className="panel-raised max-h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full max-w-lg overflow-y-auto overscroll-contain bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
      >
        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
          RIR · repetições em reserva
        </span>
        <h2 id="rir-title" className="text-display mt-1 text-2xl font-extrabold">
          Quantas reps ainda sobrariam?
        </h2>
        <p className="mt-2 text-sm text-foreground/90">
          Ao terminar a série, estime quantas repetições boas você ainda conseguiria fazer. Esse número é o RIR.
        </p>

        <ul className="mt-4 flex flex-col divide-y divide-border border-y border-border">
          {SCALE.map((level) => (
            <li
              key={level.rir}
              className={cn("flex items-center gap-3 px-2 py-2", isTarget(level.rir) && "bg-accent-soft")}
            >
              <span className="w-12 shrink-0 font-mono text-sm font-bold tabular-nums">RIR {level.rir}</span>
              <span className="min-w-0 flex-1 text-sm">{level.meaning}</span>
              {isTarget(level.rir) ? <span className="tag tag--mark shrink-0">alvo</span> : null}
            </li>
          ))}
        </ul>

        {target !== null ? (
          <p className="mt-3 text-sm">
            <span className="font-semibold">Alvo deste exercício: {formatRir(target)}</span> —{" "}
            {target < 0.5 ? "vá até a falha" : `pare ${rirSpareWords(target)}`}.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          {rirDrivesLoad
            ? "Neste exercício a carga da próxima vez é sugerida pelo RIR: anote-o em cada série."
            : "Anotar o RIR é opcional. Com ele, a sugestão de carga da próxima vez fica mais certeira."}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href="/app/science/rir">
              Entenda o RIR
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button ref={closeRef} size="lg" variant="ghost" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
