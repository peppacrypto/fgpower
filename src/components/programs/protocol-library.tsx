"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
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
  PROGRAM_GROUPS,
  SEARCH_SUGGESTIONS,
  activeFilterCount,
  applyFilters,
  groupCatalog,
  programGroup,
  sameFilters,
  searchLibrary,
  type LibraryFilters,
  type ProgramGroupKey,
} from "@/lib/programming/catalog";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Category = ProgramGroupKey | "all";

/** A choice chip (category tab, filter option): a 36px pill that takes a 44px tap (.hit). */
const CHIP =
  "hit inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border px-3 text-sm transition-colors";
const CHIP_OFF = "border-border bg-surface font-medium text-foreground hover:border-border-strong hover:bg-surface-2";
const CHIP_ON = "border-accent bg-accent-soft font-semibold text-accent";

/**
 * The program library: a search bar, then `children` (the user's programs and
 * the "Para você" pick — hidden while a search is active, so results sit right
 * under the bar), then the catalog browsed BY CATEGORY. One row of tabs
 * (Todos · the catalog's shelves) replaces the old stack of shelves: tapping a
 * tab shows just that category in one clean grid, so the page is never a wall.
 * The day/level/place/goal chips move behind a "Filtros" button (off by
 * default, so the library opens showing everything); when the page knows the
 * user, that panel offers their profile preset in one tap ("Usar meu perfil").
 * The GD series is one card (its nine blocks one tap away); a search still
 * finds each block by name, across every category and filter.
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
  /** The profile preset, offered in the filter panel ("Usar meu perfil"); never auto-applied. */
  preset?: LibraryFilters | null;
  /** Slug of the user's top recommendation (the "Para você" card). */
  pick?: string | null;
  /** Programs offered when a search finds nothing. */
  suggestions?: ProtocolCardData[];
  suggestionsLabel?: string;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searching = query.trim().length > 0;
  const filterCount = activeFilterCount(filters);
  const filtersOn = filterCount > 0;

  // The tabs: "Todos" + every non-empty catalog shelf, in catalog order.
  const groups = useMemo(() => groupCatalog(items), [items]);
  const tabs = useMemo(
    () => [
      { key: "all" as Category, short: "Todos", count: items.length },
      ...groups.map((g) => ({ key: g.key as Category, short: g.short, count: g.items.length })),
    ],
    [groups, items.length],
  );
  // A filter can empty the chosen category; the tab stays, the grid shows the note.
  const inCategory = useMemo(
    () => (category === "all" ? items : items.filter((t) => programGroup(t) === category)),
    [items, category],
  );
  const shown = useMemo(() => applyFilters(inCategory, filters), [inCategory, filters]);
  const activeGroup = category === "all" ? null : PROGRAM_GROUPS.find((g) => g.key === category) ?? null;

  // Chips the user may not have picked (the profile preset) must not hide a typed query.
  const search = useMemo(
    () => (searching ? searchLibrary(items, applyFilters(items, filters), query, filtersOn) : null),
    [searching, items, filters, query, filtersOn],
  );

  // The GD series shows as its one card, led by this user; the rest are plain cards.
  const showGd = category === "all" || category === "gd";
  const gdShown = showGd ? shown.filter((t) => programGroup(t) === "gd") : [];
  const rest = shown.filter((t) => programGroup(t) !== "gd");

  const cardsGrid = (list: ProtocolCardData[], className = "mt-4") => (
    // Two across once the library itself is wide enough (beside the sidebar on a tablet it isn't).
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3 @xl:grid-cols-2", className)}>
      {list.map((item) => (
        <ProtocolCard key={item.href} data={item} />
      ))}
    </div>
  );

  const canRestorePreset = preset !== null && preset !== undefined && activeFilterCount(preset) > 0;

  return (
    <>
      <div className="relative mt-6">
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
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-md)] text-muted hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {searching ? null : children}

      <section aria-label={label} className={cn("@container", searching ? "mt-6" : "mt-10")}>
        {searching ? (
          <div>
            <SectionHead
              label="Resultados"
              count={
                search && search.results.length > 0 ? plural(search.results.length, "programa", "programas") : undefined
              }
            />
            {search?.fatLoss ? <HonestLine /> : null}
            {search?.widenedNote ? <p className="mt-2 text-[13px] text-muted">{search.widenedNote}</p> : null}
            {search?.note ? <p className="mt-2 text-[13px] text-muted">{search.note}</p> : null}
            {search && search.results.length > 0 ? (
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
        ) : (
          <>
            {/* Categories: one row of tabs, scrolling sideways (edge to edge) on a phone and
                wrapping from sm up, so none is ever cut off. */}
            <div
              role="group"
              aria-label="Categorias"
              className="-mx-4 -my-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((tab) => {
                const selected = category === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategory(tab.key)}
                    className={cn(CHIP, "shrink-0", selected ? CHIP_ON : CHIP_OFF)}
                  >
                    {tab.short}
                    <span className={cn("tabular-nums", selected ? "text-accent" : "text-muted")}>{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {/* What's shown — the category and how many the filters left — and the Filtros toggle. */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[17px] font-semibold leading-snug">
                  {activeGroup ? activeGroup.label : "Todos os programas"}
                </span>
                <span className="text-[13px] tabular-nums text-muted">
                  {filtersOn ? `${shown.length} de ${inCategory.length}` : plural(shown.length, "programa", "programas")}
                </span>
              </p>
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-controls="library-filters"
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(CHIP, "shrink-0", filtersOn ? CHIP_ON : CHIP_OFF)}
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                Filtros
                {filtersOn ? (
                  <span className="rounded-full bg-accent px-1.5 text-xs font-semibold tabular-nums text-accent-foreground">
                    {filterCount}
                  </span>
                ) : null}
              </button>
            </div>
            {activeGroup ? <p className="mt-1 text-sm text-muted">{activeGroup.blurb}</p> : null}

            <div id="library-filters" hidden={!filtersOpen}>
              <FilterChips
                filters={filters}
                onChange={setFilters}
                preset={preset ?? null}
                onUsePreset={canRestorePreset ? () => setFilters(preset as LibraryFilters) : null}
              />
            </div>
            {filters.goal === "fat-loss" ? <HonestLine /> : null}

            {shown.length === 0 ? (
              <div className="card mt-4 px-4 py-8 text-center">
                <p className="text-[15px] font-semibold">Nenhum programa com esses filtros.</p>
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
                {gdShown.length > 0 ? (
                  <div className="mt-4">
                    <GdSeriesCard
                      // Remount when the matches change, so the list opens on them.
                      key={filtersOn ? gdShown.map((t) => t.slug).join() : "all"}
                      items={items}
                      entry={seriesEntry}
                      running={runningSlug}
                      progress={seriesProgress}
                      pick={pick}
                      matches={filtersOn ? new Set(gdShown.map((t) => t.slug)) : null}
                    />
                  </div>
                ) : null}
                {rest.length > 0 ? cardsGrid(rest, gdShown.length > 0 ? "mt-3" : "mt-4") : null}
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

/** "Musculação preserva músculo no déficit; quem emagrece é a dieta." */
function HonestLine() {
  return (
    <p className="mt-4 rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm leading-snug text-foreground">
      {FAT_LOSS_NOTE} Estes programas combinam bem com um déficit calórico.
    </p>
  );
}

// The practical choice first — goal, days available, where — then the level.
const FACETS = [
  { key: "goal", label: "Objetivo", options: GOAL_OPTIONS },
  {
    key: "days",
    label: "Dias por semana",
    // Read aloud as "3 dias por semana".
    options: DAY_OPTIONS.map((d) => ({ value: d, label: `${d} dias`, ariaLabel: `${d} dias por semana` })),
  },
  { key: "place", label: "Onde", options: PLACE_OPTIONS },
  { key: "level", label: "Nível", options: LEVEL_OPTIONS },
] as const;

/** Four single-select chip rows; tapping the selected chip clears that row. */
function FilterChips({
  filters,
  onChange,
  preset,
  onUsePreset,
}: {
  filters: LibraryFilters;
  onChange: (f: LibraryFilters) => void;
  preset: LibraryFilters | null;
  onUsePreset: (() => void) | null;
}) {
  const count = activeFilterCount(filters);
  const fromProfile = preset !== null && activeFilterCount(preset) > 0 && sameFilters(filters, preset);
  const canRestore = onUsePreset !== null && !fromProfile;

  return (
    <div role="group" aria-label="Filtros" className="card mt-3 flex flex-col gap-4 p-4 sm:p-5">
      {FACETS.map((facet) => (
        <div key={facet.key} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <span className="shrink-0 text-[13px] font-medium text-muted sm:w-32 sm:pt-2">{facet.label}</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {facet.options.map((opt) => {
              const selected = filters[facet.key] === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  aria-pressed={selected}
                  aria-label={"ariaLabel" in opt ? opt.ariaLabel : undefined}
                  onClick={() => onChange({ ...filters, [facet.key]: selected ? null : opt.value } as LibraryFilters)}
                  className={cn(CHIP, selected ? CHIP_ON : CHIP_OFF)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="flex min-h-6 flex-wrap items-center gap-x-3 border-t border-border pt-3 text-[13px] text-muted">
        {fromProfile ? (
          <span>Filtrado pelo seu perfil</span>
        ) : count > 0 ? (
          <span className="tabular-nums">{plural(count, "filtro", "filtros")}</span>
        ) : (
          <span>Nenhum filtro: mostrando todos.</span>
        )}
        {count > 0 ? (
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
          >
            Limpar
          </button>
        ) : null}
        {canRestore ? (
          <button
            type="button"
            onClick={onUsePreset}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
          >
            Usar meu perfil
          </button>
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
    <div className="mt-3">
      <p className="text-[15px] text-muted">
        Nenhum programa encontrado para “{query}”. Tente o objetivo, o nível, os dias ou onde você treina:
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SEARCH_SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => onPick(s)} className={cn(CHIP, CHIP_OFF)}>
            {s}
          </button>
        ))}
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-10">
          <SectionHead label={suggestionsLabel} />
          {grid(suggestions)}
        </div>
      ) : null}
    </div>
  );
}
