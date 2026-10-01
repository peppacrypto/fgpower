"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Search, X } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";
import {
  EQUIPMENT_FACETS,
  MY_EQUIPMENT,
  PICKER_TABS,
  VOLUME_MUSCLES,
  pickerSearchUrl,
  type PickerExercise,
  type PickerPage,
  type PickerTab,
} from "@/lib/programming/exercise-facets";

export type { PickerExercise } from "@/lib/programming/exercise-facets";

/** What the list shows: the pages fetched so far for the current query. */
interface Results {
  key: string;
  items: PickerExercise[];
  total: number;
  page: number;
  hasMore: boolean;
}

// Searches repeat a lot within one visit (a chip on, off, on again): what came
// back is kept until the picker closes. Each opening starts with an empty cache
// and asks the server again (`no-cache` skips the response's 15 s browser
// cache), so a favorite starred or a workout logged a moment ago shows in
// Favoritos / Recentes.
const cache = new Map<string, PickerPage>();

async function fetchPage(url: string, signal: AbortSignal): Promise<PickerPage> {
  const hit = cache.get(url);
  if (hit) return hit;
  const res = await fetch(url, { signal, cache: "no-cache", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const page = (await res.json()) as PickerPage;
  cache.set(url, page);
  return page;
}

const CHIP =
  "flex h-11 shrink-0 items-center px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors";
const chipTone = (on: boolean) =>
  on ? "bg-foreground text-background" : "bg-surface-2 text-foreground/75 hover:bg-[var(--border)] hover:text-foreground";

/**
 * The builder's exercise picker, full screen on a phone. Several exercises
 * are picked in one visit (each tap marks one; "Adicionar 3 exercícios" adds
 * them in tap order) — building a day used to be open → clear → type → pick
 * six times. Each opening starts clean: empty search, the user's equipment
 * ("Seu equipamento", unless they train in a full gym), the muscle it was
 * opened for. Rows show the equipment and never cut the name; an exercise
 * already in the day is tagged "NO DIA". Results come from GET
 * /api/exercises/search, 24 at a time ("Carregar mais"), and stay on screen,
 * dimmed, while the next query loads.
 *
 * With `onSelect` instead of `onAdd` it picks one exercise and closes.
 */
export function ExercisePicker({
  open,
  onClose,
  onAdd,
  onSelect,
  inDayIds = [],
  maxSelect = Infinity,
  initialMuscle = null,
  equipmentAccess = null,
  title = "Adicionar exercícios",
}: {
  open: boolean;
  onClose: () => void;
  /** Multi-select: the exercises picked, in tap order. */
  onAdd?: (exercises: PickerExercise[]) => void;
  /** Single pick: called with the exercise tapped, then the picker closes. */
  onSelect?: (exercise: PickerExercise) => void;
  /** Exercises already in the day ("NO DIA"). */
  inDayIds?: string[];
  /** Room left in the day. */
  maxSelect?: number;
  /** Opens on this muscle chip (VOLUME_MUSCLES key). */
  initialMuscle?: string | null;
  /** Profile.equipmentAccess: anything but a full gym starts on "Seu equipamento". */
  equipmentAccess?: string | null;
  title?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const defaultEquipment = equipmentAccess && equipmentAccess !== "FULL_GYM" ? MY_EQUIPMENT : null;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tab, setTab] = useState<PickerTab>("todos");
  const [muscle, setMuscle] = useState<string | null>(initialMuscle);
  const [equipment, setEquipment] = useState<string | null>(defaultEquipment);
  const [selected, setSelected] = useState<PickerExercise[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  /** The query whose search failed (a retry clears it). */
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const loadMoreAbort = useRef<AbortController | null>(null);

  // Every opening starts clean (the last search used to stay in the box).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setTab("todos");
      setMuscle(initialMuscle);
      setEquipment(defaultEquipment);
      setSelected([]);
      setResults(null);
      setFailedKey(null);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Before this opening's first search (the effect below runs after this one).
      cache.clear();
      dialog.showModal();
      // Opened for a muscle: start on its chip. Otherwise the search box with a
      // mouse; on a phone the title (a keyboard popping up would hide the chips).
      const target = initialMuscle
        ? dialog.querySelector<HTMLElement>(`[data-muscle="${initialMuscle}"]`)
        : window.matchMedia("(pointer: fine)").matches
          ? searchRef.current
          : titleRef.current;
      target?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initialMuscle]);

  useEffect(() => {
    if (query === debouncedQuery) return;
    const handle = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(handle);
  }, [query, debouncedQuery]);

  const baseQuery = { q: debouncedQuery, muscle, equipment, tab };
  const key = pickerSearchUrl({ ...baseQuery, page: 1 });

  useEffect(() => {
    if (!open) return;
    loadMoreAbort.current?.abort();
    const controller = new AbortController();
    fetchPage(key, controller.signal)
      .then((page) => setResults({ key, items: page.items, total: page.total, page: page.page, hasMore: page.hasMore }))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setFailedKey(key);
      });
    return () => controller.abort();
  }, [open, key, retry]);

  function loadMore() {
    if (!results || !results.hasMore || loadingMore) return;
    const controller = new AbortController();
    loadMoreAbort.current = controller;
    setLoadingMore(true);
    const url = pickerSearchUrl({ ...baseQuery, page: results.page + 1 });
    fetchPage(url, controller.signal)
      .then((page) =>
        setResults((r) =>
          r && r.key === key
            ? {
                ...r,
                items: [...r.items, ...page.items.filter((e) => !r.items.some((x) => x.id === e.id))],
                page: page.page,
                hasMore: page.hasMore,
              }
            : r,
        ),
      )
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setFailedKey(key);
      })
      .finally(() => setLoadingMore(false));
  }

  const multi = !!onAdd;
  const inDay = new Set(inDayIds);
  const selectedIds = new Set(selected.map((e) => e.id));
  const full = selected.length >= maxSelect;
  const filtersOn = muscle !== null || equipment !== null;
  const failed = failedKey === key;
  // The previous results stay on screen, dimmed, while this query loads — from the
  // first keystroke, not only once the pause in typing sends it ("Carregar mais"
  // would otherwise page through the old query's list).
  const typing = query !== debouncedQuery;
  const loading = typing || (!failed && results?.key !== key);
  const pending = loading || loadingMore;
  const shown = results;
  const stale = loading;

  function toggle(ex: PickerExercise) {
    if (!multi) {
      onSelect?.(ex);
      onClose();
      return;
    }
    setSelected((list) =>
      list.some((e) => e.id === ex.id) ? list.filter((e) => e.id !== ex.id) : list.length >= maxSelect ? list : [...list, ex],
    );
  }

  function add() {
    if (!selected.length) return;
    onAdd?.(selected);
    onClose();
  }

  const narrowed = debouncedQuery.trim() !== "" || filtersOn;
  const emptyText =
    tab === "favoritos"
      ? narrowed
        ? "Nenhum favorito com esses filtros."
        : "Você ainda não tem favoritos. Marque ★ em um exercício da biblioteca e ele aparece aqui."
      : tab === "recentes"
        ? narrowed
          ? "Nenhum recente com esses filtros."
          : "Nada recente ainda. Os exercícios que você treinar ou programar aparecem aqui."
        : "Nenhum exercício encontrado.";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="picker-title"
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/50 sm:m-auto sm:h-[85vh] sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-[3px]"
    >
      <div className="flex h-dvh flex-col bg-surface sm:h-[85vh] sm:rounded-[3px] sm:border-t-2 sm:border-t-[var(--rule-heavy)]">
        {/* Full screen on phones: clear the status bar / notch (installed PWA
            draws under it) and keep the search at 16px so iOS doesn't zoom. */}
        <div className="border-b border-border px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="picker-title" ref={titleRef} tabIndex={-1} className="font-mono outline-none text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-[3px] hover:bg-surface-2"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              ref={searchRef}
              type="search"
              enterKeyHint="search"
              aria-label="Buscar exercício"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // A search box eats the first Escape to clear itself; one Escape
              // should close the picker, as it does with the box empty.
              onKeyDown={(e) => {
                if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onClose();
                }
              }}
              placeholder="Buscar exercício…"
              className="pl-9 pr-10 text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div role="tablist" aria-label="Lista" className="mt-2 grid grid-cols-3 border-b border-border">
            {PICKER_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px flex h-11 items-center justify-center border-b-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em]",
                  tab === t.key ? "border-b-accent text-foreground" : "border-b-transparent text-muted hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain" aria-busy={pending || undefined}>
          <div className="flex flex-col gap-1.5 px-4 pt-3" role="group" aria-label="Filtros">
            <ChipRow label="Músculo">
              {VOLUME_MUSCLES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  data-muscle={m.key}
                  aria-pressed={muscle === m.key}
                  onClick={() => setMuscle((v) => (v === m.key ? null : m.key))}
                  className={cn(CHIP, chipTone(muscle === m.key))}
                >
                  {m.label}
                </button>
              ))}
            </ChipRow>
            <ChipRow label="Equip.">
              {equipmentAccess && equipmentAccess !== "FULL_GYM" ? (
                <button
                  type="button"
                  aria-pressed={equipment === MY_EQUIPMENT}
                  onClick={() => setEquipment((v) => (v === MY_EQUIPMENT ? null : MY_EQUIPMENT))}
                  className={cn(CHIP, chipTone(equipment === MY_EQUIPMENT))}
                >
                  Seu equipamento
                </button>
              ) : null}
              {EQUIPMENT_FACETS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={equipment === f.key}
                  onClick={() => setEquipment((v) => (v === f.key ? null : f.key))}
                  className={cn(CHIP, chipTone(equipment === f.key))}
                >
                  {f.label}
                </button>
              ))}
            </ChipRow>
          </div>

          <div className="flex min-h-11 items-center justify-between gap-3 px-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            <span aria-live="polite">
              {shown && !failed ? plural(shown.total, "exercício", "exercícios") : pending ? "Buscando…" : ""}
            </span>
            {filtersOn ? (
              <button
                type="button"
                onClick={() => {
                  setMuscle(null);
                  setEquipment(null);
                }}
                className="-mr-2 min-h-11 px-2 uppercase text-accent hover:underline"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          {failed ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted">Não foi possível buscar agora.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setFailedKey(null);
                  setRetry((n) => n + 1);
                }}
              >
                Tentar de novo
              </Button>
            </div>
          ) : !shown ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Buscando…</p>
          ) : shown.items.length === 0 ? (
            <p className={cn("px-4 py-6 text-center text-sm text-muted", stale && "opacity-60")}>{emptyText}</p>
          ) : (
            <ul className={cn("divide-y divide-border border-t border-border transition-opacity", stale && "opacity-60")}>
              {shown.items.map((ex) => {
                const isSelected = selectedIds.has(ex.id);
                const blocked = multi && full && !isSelected;
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      data-exercise-id={ex.id}
                      aria-pressed={multi ? isSelected : undefined}
                      aria-disabled={blocked || undefined}
                      onClick={() => (blocked ? undefined : toggle(ex))}
                      className={cn(
                        "flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                        isSelected
                          ? "bg-accent-soft shadow-[inset_3px_0_0_var(--accent),inset_0_-2px_0_var(--keel)]"
                          : "hover:bg-[var(--ink-2)]",
                        blocked && "opacity-45",
                      )}
                    >
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
                        {ex.imageUrl ? (
                          <Image src={ex.imageUrl} alt="" fill className="object-cover" sizes="44px" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-muted">
                            <GLoad className="size-5" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug wrap-break-word">{ex.namePt}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                          {[ex.equipment, ex.primaryMuscle].filter(Boolean).join(" · ")}
                          {inDay.has(ex.id) ? <span className="tag tag--mark">No dia</span> : null}
                        </span>
                      </span>
                      {multi ? (
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center border-2",
                            isSelected ? "border-accent bg-accent text-accent-foreground" : "border-foreground/40",
                          )}
                        >
                          {isSelected ? <Check className="size-4" strokeWidth={3} /> : null}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {shown && shown.hasMore && !failed ? (
            <div className="px-4 py-3">
              <Button variant="outline" className="w-full" disabled={pending} onClick={loadMore}>
                {loadingMore ? "Carregando…" : `Carregar mais (${shown.items.length} de ${shown.total})`}
              </Button>
            </div>
          ) : null}
          <div className="h-4" />
        </div>

        {multi ? (
          <div className="border-t-2 border-t-[var(--rule-heavy)] bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:pb-3">
            {full && Number.isFinite(maxSelect) ? (
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-warning" role="status">
                {maxSelect <= 0
                  ? "Não cabem mais exercícios neste dia"
                  : `Limite do dia: ${plural(maxSelect, "exercício selecionado", "exercícios selecionados")}`}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              {selected.length > 0 ? (
                <Button variant="ghost" className="px-3" onClick={() => setSelected([])}>
                  Limpar
                </Button>
              ) : null}
              <Button variant="strong" className="flex-1" disabled={selected.length === 0} onClick={add}>
                {selected.length === 0
                  ? "Toque para selecionar"
                  : `Adicionar ${plural(selected.length, "exercício", "exercícios")}`}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

/** A labelled row of chips that scrolls sideways inside itself on a narrow phone. */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-14 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="-mr-4 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}
