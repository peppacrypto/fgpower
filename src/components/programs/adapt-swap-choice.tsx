"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GLoad } from "@/components/ui/glyph";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";

export interface SwapOption {
  id: string;
  namePt: string;
  equipmentNamePt: string | null;
  imageUrl: string | null;
  reason: "ALTERNATIVE" | "REGRESSION" | "PROGRESSION" | "SAME_MUSCLE_PATTERN" | "SAME_MUSCLE";
  /**
   * What picking this one does to the row's prescription ("Variação mais
   * difícil: 3×6 reps…"), shown under it while it is the chosen one — so the
   * line follows the pick instead of describing only the suggested default.
   */
  note?: string | null;
}

/** Why a stand-in was offered, in a few words. */
const REASON: Record<SwapOption["reason"], string> = {
  ALTERNATIVE: "alternativa indicada",
  REGRESSION: "versão mais simples",
  PROGRESSION: "versão mais difícil",
  SAME_MUSCLE_PATTERN: "mesmo músculo e movimento",
  SAME_MUSCLE: "mesmo músculo",
};

const KEEP = "keep";

/**
 * The swaps the review will save, live: the fields (`swap:<row>`) still set
 * to a stand-in. "Manter …" on a row takes it out of the day's "N trocas" and
 * the "Salvar com N trocas" button at once.
 */
const SwapsContext = createContext<{ swapped: ReadonlySet<string>; set: (name: string, on: boolean) => void } | null>(null);

export function AdaptSwapCounts({ initial, children }: { initial: string[]; children: ReactNode }) {
  const [swapped, setSwapped] = useState<ReadonlySet<string>>(() => new Set(initial));
  const set = useCallback(
    (name: string, on: boolean) =>
      setSwapped((prev) => {
        if (prev.has(name) === on) return prev;
        const next = new Set(prev);
        if (on) next.add(name);
        else next.delete(name);
        return next;
      }),
    [],
  );
  const value = useMemo(() => ({ swapped, set }), [swapped, set]);
  return <SwapsContext.Provider value={value}>{children}</SwapsContext.Provider>;
}

function useSwapCount(names?: readonly string[]) {
  const swapped = useContext(SwapsContext)?.swapped;
  if (!swapped) return 0;
  return names ? names.filter((n) => swapped.has(n)).length : swapped.size;
}

/** A day's "2 trocas" / "sem trocas": its rows still set to a stand-in. */
export function DaySwapCount({ names }: { names: string[] }) {
  const n = useSwapCount(names);
  return <>{n > 0 ? plural(n, "troca", "trocas") : "sem trocas"}</>;
}

/**
 * The save button's label: "Salvar com 3 trocas", or — once every row is kept —
 * `none` ("Salvar meu programa" for a template's copy).
 */
export function AdaptSaveLabel({ none = "Salvar meu programa" }: { none?: string }) {
  const n = useSwapCount();
  return <>{n > 0 ? `Salvar com ${plural(n, "troca", "trocas")}` : none}</>;
}

/**
 * A review's floating bar, inside its form and AdaptSwapCounts: "Cancelar"
 * back to where the review came from and "Salvar com N trocas". `alert`, when
 * given, is the form's own failure line, shown above the buttons.
 */
export function AdaptSaveBar({ cancelHref, none, alert }: { cancelHref: string; none?: string; alert?: ReactNode }) {
  return (
    <div
      data-bottom-bar
      className="sticky bottom-[calc(var(--nav-h)+0.5rem)] z-20 mt-6 flex flex-wrap items-center gap-2 rounded-[var(--radius-xl)] border border-border bg-surface p-2 shadow-[var(--shadow-md)] sm:bottom-4 sm:justify-end sm:p-2.5"
    >
      {alert}
      <Button asChild variant="ghost" className="px-3">
        <Link href={cancelHref}>Cancelar</Link>
      </Button>
      <SubmitButton variant="strong" className="flex-1 px-4 sm:flex-none" pendingLabel="Salvando…">
        <AdaptSaveLabel none={none} />
      </SubmitButton>
    </div>
  );
}

/**
 * One swap on an "Adaptar" review (a template's copy) or on "Ajustar à minha
 * academia" (the user's own program): the stand-in chosen, its whole name (a
 * native select cut it at the variant on a 320px phone) with its equipment
 * and why it was picked — and, when picking it changes the prescription, how
 * (SwapOption.note) — and "Trocar ▾" — the real <select>, laid over the chip,
 * so the phone's own picker opens and the form posts the field as before.
 * "Manter …" keeps the original (the user has that machine after all), and
 * the counts (AdaptSwapCounts) follow.
 */
export function AdaptSwapChoice({
  name,
  original,
  options,
  defaultId,
}: {
  /** The form field: `swap:<row>` (alternatives adaptRowKey), or `swap:<exercise>:<rows>` (actions/program-gear). */
  name: string;
  original: { namePt: string; equipmentNamePt: string | null };
  options: SwapOption[];
  defaultId: string;
}) {
  const [value, setValue] = useState(defaultId);
  const counts = useContext(SwapsContext);
  const chosen = options.find((o) => o.id === value) ?? null;
  const keep = value === KEEP;

  return (
    <div className="mt-2 flex items-start gap-3" data-swap-choice>
      <span className="relative size-11 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
        {chosen?.imageUrl ? (
          <Image src={chosen.imageUrl} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-muted">
            <GLoad className="size-4" />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug wrap-break-word" data-swap-chosen>
          {keep ? original.namePt : chosen?.namePt}
        </p>
        <p className="mt-0.5 text-[13px] text-muted" data-swap-meta>
          {keep
            ? `${original.equipmentNamePt ?? ""} · mantido`
            : [chosen?.equipmentNamePt, chosen ? REASON[chosen.reason] : null].filter(Boolean).join(" · ")}
        </p>
        {!keep && chosen?.note ? (
          <p className="mt-1 text-[13px] leading-snug text-muted" data-swap-note>
            {chosen.note}
          </p>
        ) : null}
      </div>
      <label
        className={cn(
          "relative flex h-11 shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-3 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)]",
          "bg-surface-2 text-foreground hover:bg-[var(--border)]",
        )}
      >
        Trocar
        <ChevronDown className="size-4" aria-hidden />
        <select
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            counts?.set(name, e.target.value !== KEEP);
          }}
          aria-label={`Trocar ${original.namePt} por`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.namePt}
              {o.equipmentNamePt ? ` — ${o.equipmentNamePt.toLowerCase()}` : ""}
            </option>
          ))}
          <option value={KEEP}>Manter {original.namePt} (tenho acesso)</option>
        </select>
      </label>
    </div>
  );
}
