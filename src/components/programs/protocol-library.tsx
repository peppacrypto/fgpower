"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SectionHead } from "@/components/ui/section-head";
import { ProtocolCard, type ProtocolCardData } from "@/components/programs/protocol-card";
import { GdSeriesCard, type SeriesProgress } from "@/components/programs/gd-series-card";
import { FAT_LOSS_NOTE } from "@/lib/constants/program-labels";
import {
  DAY_OPTIONS,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  NO_FILTERS,
  PLACE_OPTIONS,
  SEARCH_SUGGESTIONS,
  activeFilterCount,
  applyFilters,
  groupCatalog,
  programGroup,
  sameFilters,
  searchLibrary,
  shelveFiltered,
  type LibraryFilters,
  type Shelf,
} from "@/lib/programming/catalog";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * The program library: a search bar, then `children` (the user's programs and
 * the "Para você" pick — hidden while a search is active, so results sit right
 * under the bar), then the catalog with chip filters (days · level · place ·
 * goal), shelved by kind. Everything filters instantly on the client. When
 * the page knows the user, the chips start preset from their profile
 * ("Filtrado pelo seu perfil · limpar"). Filtered, the shelf holding the
 * user's pick leads (see shelveFiltered). The GD series is one card (its
 * blocks one tap away) rather than nine look-alike ones — a search still
 * finds each block by name.
 */
export function ProtocolLibrary({
  label,
  items,
  preset,
  pick = null,
  suggestions = [],
  suggestionsLabel = "Para você",
  seriesEntry = "gd-adaptacao",
  runningSlug = null,
  seriesProgress = null,
  children,
}: {
  label: string;
  items: ProtocolCardData[];
  /** Where the GD card sends this user first: "gd-adaptacao" (new to lifting) or "gd-1". */
  seriesEntry?: string;
  /** The template the user is running: the GD card points at it when it's a block. */
  runningSlug?: string | null;
  /** Where the user stands in the GD series (blocks finished, the next one, one to resume): the GD card goes on from it. */
  seriesProgress?: SeriesProgress | null;
  /** Chips preselected from the profile; null/undefined = start unfiltered. */
  preset?: LibraryFilters | null;
  /** Slug of the user's top recommendation (the "Para você" card). */
  pick?: string | null;
  /** Programs offered when a search finds nothing. */
  suggestions?: ProtocolCardData[];
  suggestionsLabel?: string;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LibraryFilters>(preset ?? NO_FILTERS);
  const searching = query.trim().length > 0;
  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);
  const filtersOn = activeFilterCount(filters) > 0;

  // Chips the user may not have picked (the profile preset) must not hide what they typed.
  const search = useMemo(
    () => (searching ? searchLibrary(items, filtered, query, filtersOn) : null),
    [searching, filtered, items, query, filtersOn],
  );
  const shelves: Shelf<ProtocolCardData>[] = useMemo(
    () =>
      filtersOn ? shelveFiltered(filtered, items, pick) : groupCatalog(filtered).map((g) => ({ ...g, start: null })),
    [filtersOn, filtered, items, pick],
  );

  // Unfiltered, each shelf shows its first cards and a "Ver todos" toggle —
  // 48 cards in a row is a wall on a phone. The rest stay in the HTML (hidden),
  // so every program is still a link for crawlers and page search.
  const [openShelves, setOpenShelves] = useState<ReadonlySet<string>>(new Set());
  const previewShelves = !filtersOn;

  // `lead` sits ahead of the numbered cards without a numeral: it isn't one of
  // the matches the shelf's count counts (the GD series entry, see Shelf.start).
  const cardsGrid = (list: ProtocolCardData[], first = 1, className = "mt-4", lead: ProtocolCardData | null = null) => (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2", className)}>
      {lead ? <ProtocolCard key={lead.href} data={{ ...lead, index: null }} /> : null}
      {list.map((item, i) => (
        <ProtocolCard key={item.href} data={{ ...item, index: first + i }} />
      ))}
    </div>
  );

  return (
    <>
      <div className="relative mt-8">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          id="program-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: iniciante, 3 dias, GD"
          aria-label="Buscar programa"
          // one clear button: ours (the browser's own sat next to it)
          className="pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {searching ? null : children}

      <section aria-label={label} className={searching ? "mt-6" : "mt-12"}>
        {searching ? null : <SectionHead label={label} count={countLabel(filtered.length, items.length, filtersOn)} />}
        <FilterChips filters={filters} onChange={setFilters} preset={preset ?? null} />

        {search ? (
          <div className="mt-6">
            <SectionHead
              label="Resultados"
              count={search.results.length > 0 ? plural(search.results.length, "programa", "programas") : undefined}
            />
            {search.fatLoss ? <HonestLine /> : null}
            {search.widenedNote ? <p className="mt-3 text-xs text-muted">{search.widenedNote}</p> : null}
            {search.note ? <p className="mt-3 text-xs text-muted">{search.note}</p> : null}
            {search.results.length > 0 ? (
              cardsGrid(search.results)
            ) : (
              <EmptySearch
                query={query.trim()}
                onPick={setQuery}
                suggestions={suggestions}
                suggestionsLabel={suggestionsLabel}
                grid={cardsGrid}
              />
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 border-y border-border py-6 text-center">
            <p className="text-sm font-semibold">Nenhum programa com esses filtros.</p>
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              className="mt-2 inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            {filters.goal === "fat-loss" ? <HonestLine /> : null}
            {shelves.map((group) => {
              if (group.key === "gd") {
                const total = items.filter((t) => programGroup(t) === "gd").length;
                return (
                  <section key={group.key} aria-label={group.label} className="mt-10 first:mt-8">
                    <SectionHead
                      as="h3"
                      label={group.label}
                      count={filtersOn ? `${group.items.length} de ${total} blocos` : `${total} blocos`}
                    />
                    <GdSeriesCard
                      // Remount when the filters change, so the list opens on the new matches.
                      key={filtersOn ? group.items.map((t) => t.slug).join() : "all"}
                      items={items}
                      entry={seriesEntry}
                      running={runningSlug}
                      progress={seriesProgress}
                      pick={pick}
                      matches={filtersOn ? new Set(group.items.map((t) => t.slug)) : null}
                    />
                  </section>
                );
              }
              const collapsible = previewShelves && group.items.length > SHELF_PREVIEW + 1;
              const open = !collapsible || openShelves.has(group.key);
              const restId = `shelf-${group.key}-rest`;
              return (
                <section key={group.key} aria-label={group.label} className="mt-10 first:mt-8">
                  <SectionHead as="h3" label={group.label} count={String(group.items.length)} />
                  <p className="mt-1.5 text-xs text-muted">{group.blurb}</p>
                  {collapsible ? (
                    <>
                      {cardsGrid(group.items.slice(0, SHELF_PREVIEW))}
                      <div id={restId} hidden={!open}>
                        {cardsGrid(group.items.slice(SHELF_PREVIEW), SHELF_PREVIEW + 1, "mt-3")}
                      </div>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={restId}
                        onClick={() =>
                          setOpenShelves((prev) => {
                            const next = new Set(prev);
                            if (open) next.delete(group.key);
                            else next.add(group.key);
                            return next;
                          })
                        }
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 border border-border font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:bg-surface-2"
                      >
                        {open ? "Mostrar menos" : `Ver todos (${group.items.length})`}
                        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
                      </button>
                    </>
                  ) : (
                    cardsGrid(group.items, 1, "mt-4", group.start && { ...group.start, mark: "Início da série" })
                  )}
                </section>
              );
            })}
          </>
        )}
      </section>
    </>
  );
}

/** Cards a shelf shows before "Ver todos" when the library is unfiltered. */
const SHELF_PREVIEW = 4;

function countLabel(shown: number, total: number, filtersOn: boolean) {
  return filtersOn ? `${shown} de ${total}` : String(total);
}

/** "Musculação preserva músculo no déficit; quem emagrece é a dieta." */
function HonestLine() {
  return (
    <p className="mt-4 border-l-2 border-l-accent bg-surface-2 px-3 py-2 text-xs leading-snug text-foreground/85">
      {FAT_LOSS_NOTE} Estes programas combinam bem com um déficit calórico.
    </p>
  );
}

const FACETS = [
  {
    key: "days",
    label: "Dias",
    // "3×" is read aloud as "3 multiplication sign": name it in words.
    options: DAY_OPTIONS.map((d) => ({ value: d, label: `${d}×`, ariaLabel: `${d} dias por semana` })),
  },
  { key: "level", label: "Nível", options: LEVEL_OPTIONS },
  { key: "place", label: "Onde", options: PLACE_OPTIONS },
  { key: "goal", label: "Objetivo", options: GOAL_OPTIONS },
] as const;

/** Four single-select mono chip rows; tapping the selected chip clears that row. */
function FilterChips({
  filters,
  onChange,
  preset,
}: {
  filters: LibraryFilters;
  onChange: (f: LibraryFilters) => void;
  preset: LibraryFilters | null;
}) {
  const count = activeFilterCount(filters);
  const fromProfile = preset !== null && activeFilterCount(preset) > 0 && sameFilters(filters, preset);
  const canRestore = preset !== null && activeFilterCount(preset) > 0 && !fromProfile;

  return (
    <div role="group" aria-label="Filtros" className="mt-4 flex flex-col gap-1.5">
      {FACETS.map((facet) => (
        <div key={facet.key} className="flex min-w-0 items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            {facet.label}
          </span>
          {/* Scrolls sideways inside the row on narrow phones, never the page. */}
          <div className="-my-1 flex min-w-0 flex-1 gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {facet.options.map((opt) => {
              const selected = filters[facet.key] === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  aria-pressed={selected}
                  aria-label={"ariaLabel" in opt ? opt.ariaLabel : undefined}
                  onClick={() => onChange({ ...filters, [facet.key]: selected ? null : opt.value } as LibraryFilters)}
                  className={cn(
                    "h-11 shrink-0 px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors",
                    selected
                      ? "bg-foreground text-background"
                      : "bg-surface-2 text-foreground/75 hover:bg-[var(--border)] hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="mt-1 flex min-h-6 flex-wrap items-center gap-x-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
        {fromProfile ? (
          <span>Filtrado pelo seu perfil</span>
        ) : count > 0 ? (
          <span>{plural(count, "filtro", "filtros")}</span>
        ) : null}
        {count > 0 ? (
          <>
            <span aria-hidden>·</span>
            <button type="button" onClick={() => onChange(NO_FILTERS)} className="min-h-11 px-1 uppercase text-accent hover:underline">
              Limpar
            </button>
          </>
        ) : null}
        {canRestore ? (
          <>
            {count > 0 ? <span aria-hidden>·</span> : null}
            <button type="button" onClick={() => onChange(preset)} className="min-h-11 px-1 uppercase text-accent hover:underline">
              Usar meu perfil
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

function EmptySearch({
  query,
  onPick,
  suggestions,
  suggestionsLabel,
  grid,
}: {
  query: string;
  onPick: (q: string) => void;
  suggestions: ProtocolCardData[];
  suggestionsLabel: string;
  grid: (list: ProtocolCardData[]) => React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm text-muted">
        Nenhum programa encontrado para “{query}”. Tente o objetivo, o nível, os dias ou onde você treina:
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SEARCH_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="h-11 bg-surface-2 px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/80 hover:bg-[var(--border)]"
          >
            {s}
          </button>
        ))}
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-8">
          <SectionHead label={suggestionsLabel} />
          {grid(suggestions)}
        </div>
      ) : null}
    </div>
  );
}
