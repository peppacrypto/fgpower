"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudOff } from "lucide-react";
import { Meter } from "@/components/ui/meter";
import { SaveStatus } from "@/components/ui/save-status";
import { SectionHead } from "@/components/ui/section-head";
import { ChipRadioGroup } from "@/app/app/settings/chip-radio-group";
import {
  MAX_PIECES,
  choiceLabel,
  countsOf,
  dayTotals,
  kindWords,
  markOf,
  piecesTotal,
  servingOf,
  type DietDayMarks,
  type DietItem,
  type DietMark,
  type DietMeal,
  type DietPieceKind,
  type DietPieces,
  type DietTargets,
} from "@/lib/diet/plan";
import { cn } from "@/lib/utils/cn";
import { formatNumber, plural } from "@/lib/utils/format";
import { EMPTY_OUTBOX_STATE, dietOutbox, entryApplies, markKey, type DietFailure, type DietOutboxState } from "./diet-outbox";

const NBSP = " ";
const noSubscribe = () => () => {};
const emptyState = () => EMPTY_OUTBOX_STATE;
const whole = (n: number) => formatNumber(Math.round(n), 0);

/** What a failed save says, under the targets: the outbox retries (or holds) the marks on its own. */
function failureText(failure: DietFailure, pending: number): string {
  if (failure.kind === "session" || failure.kind === "rejected") return failure.message;
  const one = pending === 1;
  const held = pending === 0 ? "" : ` ${one ? "1 marcação fica" : `${formatNumber(pending, 0)} marcações ficam`} neste aparelho`;
  if (failure.kind === "offline") return `Sem conexão.${held ? `${held} e ${one ? "vai" : "vão"} quando o sinal voltar.` : ""}`;
  return `Não foi possível salvar agora.${held ? `${held}; tentando de novo.` : " Tentando de novo."}`;
}

/**
 * One day of the plan (Dieta): the targets and what the eaten items add up
 * to, then the meals — each item one big tap to mark it eaten, its
 * alternative a choice under it ("Frango | Sardinha"), an item counted in
 * pieces a counter per kind ("Com gema − 3 +"). Every tap shows at once and is
 * saved from the outbox (diet-outbox.ts), which retries until the server has
 * it and keeps it on this device meanwhile. Remounted per day.
 */
export function DietDay({
  userId,
  date,
  loadedAtMs,
  meals,
  targets,
  marks,
}: {
  userId: string;
  /** The day shown, "2026-11-13". */
  date: string;
  /** Server time `marks` were read: a confirmation newer than this still speaks over them. */
  loadedAtMs: number;
  meals: DietMeal[];
  targets: DietTargets;
  marks: DietDayMarks;
}) {
  const router = useRouter();
  // Browser only (localStorage, timers); the server render and hydration see an empty outbox.
  const outbox = typeof window === "undefined" ? null : dietOutbox(userId);
  const state: DietOutboxState = useSyncExternalStore(outbox ? outbox.subscribe : noSubscribe, outbox ? outbox.getState : emptyState, emptyState);

  // What an earlier visit left unsent goes now; a plan changed under the page reloads its data.
  useEffect(() => {
    if (!outbox) return;
    outbox.flush();
    return outbox.onStale(() => router.refresh());
  }, [outbox, router]);
  // Confirmations the page's data already has are forgotten.
  useEffect(() => {
    outbox?.settle(date, loadedAtMs);
  }, [outbox, date, loadedAtMs]);

  function shown(itemId: string): DietMark & { pending: boolean } {
    const entry = state.entries.get(markKey(date, itemId));
    if (entry && entryApplies(entry, loadedAtMs)) {
      const { eaten, choiceId, counts } = entry.mark;
      return { eaten, choiceId, counts: counts ?? null, pending: entry.confirmedAtMs === null };
    }
    return { ...markOf(marks, itemId), pending: false };
  }

  const dayMarks: Record<string, DietMark> = {};
  for (const meal of meals) for (const item of meal.items) dayMarks[item.id] = shown(item.id);
  const totals = dayTotals(meals, dayMarks);
  const stuck = state.failure != null && state.failure.kind !== "rejected";

  function set(item: DietItem, next: DietMark) {
    outbox?.mark({ date, itemId: item.id, eaten: next.eaten, choiceId: next.choiceId, counts: next.counts });
  }

  return (
    <>
      <section className="card mt-5 p-4 sm:p-5" aria-labelledby="dieta-metas" data-diet-totals>
        <div className="flex items-baseline gap-3">
          <h2 id="dieta-metas" className="min-w-0 flex-1 text-[17px] font-semibold leading-snug">
            Metas do dia
          </h2>
          <span className="shrink-0 text-[13px] tabular-nums text-muted" data-diet-count>
            {totals.eaten} de {plural(totals.items, "item", "itens")}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <Meter label="Calorias" value={totals.kcal} max={targets.kcal} valueText={`${whole(totals.kcal)} de ${whole(targets.kcal)}${NBSP}kcal`} />
          <Meter label="Proteína" value={totals.protein} max={targets.protein} valueText={`${whole(totals.protein)} de ${whole(targets.protein)}${NBSP}g`} />
          <Meter label="Carboidratos" value={totals.carbs} max={targets.carbs} valueText={`${whole(totals.carbs)} de ${whole(targets.carbs)}${NBSP}g`} />
          <Meter label="Gorduras" value={totals.fat} max={targets.fat} valueText={`${whole(totals.fat)} de ${whole(targets.fat)}${NBSP}g`} />
        </div>
        {targets.fiber != null ? (
          <p className="mt-3 text-[13px] text-muted">
            Meta de fibras: {whole(targets.fiber)}
            {NBSP}g por dia.
          </p>
        ) : null}
        <SaveStatus
          className="mt-2"
          pending={state.sending && state.failure == null}
          savedAt={state.savedAt}
          error={state.failure ? failureText(state.failure, state.pending) : null}
        />
      </section>

      {meals.map((meal) => {
        const eatenHere = meal.items.filter((i) => dayMarks[i.id]?.eaten).length;
        const kcalHere = meal.items.reduce((sum, i) => sum + servingOf(i, markOf(dayMarks, i.id)).kcal, 0);
        return (
          <section key={meal.id} className="mt-8" aria-labelledby={`refeicao-${meal.id}`} data-diet-meal={meal.id}>
            <SectionHead
              id={`refeicao-${meal.id}`}
              label={meal.name}
              count={`${eatenHere} de ${meal.items.length} · ${whole(kcalHere)}${NBSP}kcal`}
            />
            <ul className="card mt-3 divide-y divide-border overflow-hidden">
              {meal.items.map((item) => (
                <DietItemRow
                  key={item.id}
                  item={item}
                  mark={shown(item.id)}
                  stuck={stuck}
                  onChange={(next) => set(item, next)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/**
 * One item: the whole row marks it eaten (a checkbox); its alternatives, when
 * it has any, a choice under it; its pieces, when counted in pieces, a counter
 * per kind under it.
 */
function DietItemRow({
  item,
  mark,
  stuck,
  onChange,
}: {
  item: DietItem;
  mark: DietMark & { pending: boolean };
  /** Saves are failing: a mark the server doesn't have yet says so. */
  stuck: boolean;
  onChange: (next: DietMark) => void;
}) {
  const option = servingOf(item, mark);
  const options = item.alternatives?.length ? [item, ...item.alternatives] : null;
  const detail = option.measure ? `${option.amount} · ${option.measure}` : option.amount;

  function toggle() {
    // Every counter at 0 is no piece eaten: marking it eaten brings back the plan's pieces.
    if (!mark.eaten && item.pieces && piecesTotal(countsOf(item.pieces, mark.counts)) === 0) {
      onChange({ eaten: true, choiceId: null, counts: null });
      return;
    }
    onChange({ eaten: !mark.eaten, choiceId: mark.choiceId, counts: mark.counts });
  }
  return (
    <li
      data-diet-item={item.id}
      data-eaten={mark.eaten ? "true" : "false"}
      data-pending={mark.pending ? "true" : undefined}
      // Eaten: the whole item wears the soft green, its choice included.
      className={cn("transition-colors", mark.eaten && "bg-accent-soft")}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={mark.eaten}
        aria-label={`${option.food}, ${option.amount}, ${whole(option.kcal)} kcal`}
        onClick={toggle}
        className={cn(
          "flex min-h-16 w-full touch-manipulation items-center gap-3 px-4 py-3 text-left",
          !mark.eaten && "transition-colors hover:bg-surface-2 active:bg-surface-2",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
            mark.eaten ? "border-accent bg-accent text-accent-foreground" : "border-field bg-surface",
          )}
        >
          {mark.eaten ? <Check className="size-4" strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug">{option.food}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">{detail}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block whitespace-nowrap text-[15px] font-semibold tabular-nums">
            {whole(option.kcal)}
            {NBSP}kcal
          </span>
          <span className="block whitespace-nowrap text-[13px] tabular-nums text-muted">
            {whole(option.protein)}
            {NBSP}g prot.
          </span>
          {stuck && mark.pending ? (
            <span className="mt-0.5 flex items-center justify-end gap-1 text-[12px] font-medium text-muted">
              <CloudOff className="size-3.5" aria-hidden />
              não enviado
            </span>
          ) : null}
        </span>
      </button>
      {options ? (
        <div className="-mt-1 pb-3 pl-14 pr-4">
          <ChipRadioGroup
            label={`No lugar: ${options.map(choiceLabel).join(" ou ")}`}
            options={options.map((o) => ({ value: o.id, label: choiceLabel(o) }))}
            value={option.id}
            onChange={(id) => {
              const choiceId = id === item.id ? null : id;
              if (choiceId !== mark.choiceId) onChange({ eaten: mark.eaten, choiceId, counts: mark.counts });
            }}
          />
        </div>
      ) : null}
      {item.pieces ? <PiecesCounter pieces={item.pieces} mark={mark} onChange={onChange} /> : null}
    </li>
  );
}

// Drawn like the choice chips (a bordered plate), so they read on the eaten item's green as well.
const STEP =
  "flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-xl font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-2 active:bg-surface-2 disabled:opacity-35";

/**
 * An item counted in pieces: one counter per kind ("Com gema − 3 +", "Sem gema
 * − 0 +"), starting at the plan's. A count changed is what was eaten, so it
 * marks the item eaten — and every counter at 0, not eaten. Counts back at the
 * plan's are kept as the plan's (nothing of their own).
 */
function PiecesCounter({ pieces, mark, onChange }: { pieces: DietPieces; mark: DietMark; onChange: (next: DietMark) => void }) {
  const counts = countsOf(pieces, mark.counts);

  function step(kind: DietPieceKind, delta: 1 | -1) {
    const next = { ...counts, [kind.id]: Math.min(MAX_PIECES, Math.max(0, counts[kind.id] + delta)) };
    const asPlanned = pieces.kinds.every((k) => next[k.id] === k.planned);
    onChange({ eaten: piecesTotal(next) > 0, choiceId: null, counts: asPlanned ? null : next });
  }

  return (
    // Under the item's words from 360px; on a narrower phone from the edge, so a label stays on one line.
    <div role="group" aria-label={`Quantos ${pieces.many}`} className="-mt-1 flex flex-col gap-2 pb-3 pl-4 pr-4 min-[360px]:pl-14" data-diet-pieces>
      {pieces.kinds.map((kind) => {
        const n = counts[kind.id];
        const words = kindWords(kind);
        return (
          <div key={kind.id} className="flex items-center gap-3" data-diet-kind={kind.id}>
            <p className="min-w-0 flex-1 leading-snug">
              <span className="block text-[15px] font-medium">{kind.label}</span>
              <span className="block text-[13px] tabular-nums text-muted">
                {whole(kind.kcal)}
                {NBSP}kcal cada
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" className={STEP} aria-label={`Menos 1 ${pieces.one} ${words}`} disabled={n <= 0} onClick={() => step(kind, -1)}>
                −
              </button>
              <span className="w-8 text-center text-[17px] font-semibold tabular-nums" aria-live="polite">
                <span aria-hidden data-count>
                  {n}
                </span>
                <span className="sr-only">
                  {n} {words}
                </span>
              </span>
              <button
                type="button"
                className={STEP}
                aria-label={`Mais 1 ${pieces.one} ${words}`}
                disabled={n >= MAX_PIECES}
                onClick={() => step(kind, 1)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
