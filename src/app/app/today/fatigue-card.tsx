import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import type { FatigueSignal } from "@/lib/data/fatigue";
import { FatigueFrame } from "./fatigue-frame";

const KICKER = "font-mono text-[11px] font-bold uppercase tracking-[0.14em]";
/** "RIR 3-4" never breaks at its hyphen (a 320px line would end in "RIR 3-"). */
const RIR_3_4 = <span className="whitespace-nowrap">RIR 3-4</span>;

/** The program's rule, as GD writes it — or the usual rule, for any other program. */
function ruleText(gd: boolean, keySource: "anchors" | "first") {
  const keys = keySource === "anchors" ? "âncoras e benchmarks" : "o primeiro exercício de cada dia";
  const triggers = `reps caindo 2+ em 2+ exercícios-chave (${keys}) por 2 sessões seguidas; dor articular ou muscular por mais de 72 h; menos de 6 h de sono em 3+ noites; estresse alto ou motivação baixa por 1 semana ou mais.`;
  return gd ? `Gatilhos do programa: ${triggers}` : `Gatilhos comuns de deload: ${triggers}`;
}

/**
 * Today's fatigue signal (W-128, decision 16 — a suggestion; nothing changes
 * until the user taps "Aplicar deload", and it can be undone): the program's
 * early-deload triggers seen in the last 7 days, why, and the choice; or,
 * once applied, the week's deload with "Desfazer" until a workout starts
 * under it. Neutral ink, never a warning colour: fatigue is part of
 * training. Placed right after the focus block; Today decides whether it
 * shows (lib/data/fatigue getFatigueSignal, "Agora não" per week) — and keeps
 * a closed one rendered as its frame's live region (FatigueFrame).
 */
export function FatigueCard({
  signal,
  gd,
  dismissed = false,
  arrived = false,
}: {
  signal: FatigueSignal;
  gd: boolean;
  /** "Agora não" / "Entendi" closed this week's signal: the frame stays, as its live region alone. */
  dismissed?: boolean;
  /** Just back from "Aplicar deload" / "Desfazer": the card takes the focus. */
  arrived?: boolean;
}) {
  // One frame per level and week: a new level or week is a new card (its own state).
  const frame = { enrollmentId: signal.enrollmentId, weekKey: signal.weekKey, arrived };
  if (signal.level === "applied") {
    return (
      <FatigueFrame key={`applied:${signal.weekKey}`} level="applied" {...frame} canUndo={!signal.started}>
        <p className={KICKER}>Deload aplicado{signal.week != null ? ` · semana ${signal.week}` : ""}</p>
        <p className="mt-0.5 text-xs text-foreground/90">
          Metade das séries, mesmas cargas, {RIR_3_4}. A progressão volta na semana que vem.
        </p>
      </FatigueFrame>
    );
  }

  const n = signal.triggers.length;
  const why = (
    <details className="group/why mt-1.5">
      <summary className="-mx-1 inline-flex min-h-11 cursor-pointer list-none items-center gap-1 px-1 text-xs font-semibold text-accent [&::-webkit-details-marker]:hidden">
        Por quê?
        <ChevronDown className="size-3.5 transition-transform group-open/why:rotate-180" aria-hidden />
      </summary>
      <ul className="flex flex-col gap-1 pb-1 text-xs text-foreground/90" data-fatigue-evidence>
        {signal.triggers.map((t) => (
          <li key={t.key} className="border-l border-border pl-2">
            {t.text}.
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{ruleText(gd, signal.keySource)}</p>
      <Link
        href="/app/science/deloads"
        className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-accent hover:underline"
      >
        Deloads
        <GArrow className="size-3" />
      </Link>
    </details>
  );

  if (signal.level === "deload") {
    return (
      <FatigueFrame key={`deload:${signal.weekKey}`} level="deload" {...frame} dismissed={dismissed}>
        <p className={KICKER}>Sinal de fadiga · {n} de 4 gatilhos</p>
        <p className="mt-0.5 text-xs text-foreground/90">
          {gd
            ? `Nos últimos 7 dias apareceram ${n} dos gatilhos de deload do programa. A regra dele: com 2 ou mais, uma semana leve — metade das séries, mesmas cargas, `
            : `Nos últimos 7 dias apareceram ${n} gatilhos comuns de deload. A regra usual: com 2 ou mais, uma semana leve — metade das séries, mesmas cargas, `}
          {RIR_3_4}. É uma sugestão; você decide.
        </p>
        {why}
      </FatigueFrame>
    );
  }

  if (signal.level === "deload-next") {
    return (
      <FatigueFrame key={`deload-next:${signal.weekKey}`} level="deload-next" {...frame} dismissed={dismissed}>
        <p className={KICKER}>Sinal de fadiga</p>
        <p className="mt-0.5 text-xs text-foreground/90">
          Apareceram {n} gatilhos de deload, e o deload do programa já vem na semana que vem. Até lá, treine com 2+ reps na
          reserva e sem técnicas.
        </p>
        {why}
      </FatigueFrame>
    );
  }

  // "watch": the reps trigger alone.
  const drops = signal.triggers[0]?.count ?? 2;
  return (
    <FatigueFrame key={`watch:${signal.weekKey}`} level="watch" {...frame} dismissed={dismissed}>
      <p className={KICKER}>Atenção à recuperação</p>
      <p className="mt-0.5 text-xs text-foreground/90">
        Reps caindo 2+ em {drops} exercícios-chave nas 2 últimas sessões. Sono curto, dor que dura mais de 72 h e estresse
        também contam — com 2 sinais, {gd ? "o programa sugere" : "a regra usual é"} deload. Marque no check-in depois do
        treino.
      </p>
      {why}
    </FatigueFrame>
  );
}
