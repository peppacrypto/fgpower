"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { SectionHead } from "@/components/ui/section-head";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";
import {
  DIFFICULTY_OPTIONS,
  LIBRARY_KEYS,
  LIBRARY_LISTS,
  libraryHref,
  type LibraryState,
} from "./library-params";

interface FilterOption {
  id: string;
  namePt: string;
}

/** Quiet time after the last keystroke before the list follows the box. */
const SEARCH_DEBOUNCE_MS = 300;

const MICRO = "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted";

function stateOf(params: URLSearchParams): LibraryState {
  const out = {} as LibraryState;
  for (const key of LIBRARY_KEYS) out[key] = params.get(key) ?? "";
  return out;
}

const EMPTY: LibraryState = { q: "", muscleGroup: "", equipmentId: "", movementPatternId: "", difficulty: "", lista: "" };

/**
 * The exercise library's search and filters, wrapped around its results.
 *
 * - The text search waits for a pause in typing, then *replaces* the URL: one
 *   request per search instead of one per letter, and Back leaves the library
 *   instead of un-typing it letter by letter.
 * - The box follows the URL when something else moves it (Back, a "Limpar
 *   filtros" link), so it never shows words the list isn't filtered by.
 * - While a new list loads, the results dim and the count reads "Buscando…".
 * - Muscle is a row of chips (the filter people use most); equipment is one
 *   select; movement and level wait under "Mais filtros".
 * - Every control keeps a visible label, so a picked value still says what it filters.
 */
export function ExerciseFilterBar({
  muscleGroups,
  equipment,
  movementPatterns,
  total,
  lists,
  unclassifiedPatterns = 0,
  children,
}: {
  muscleGroups: { group: string; namePt: string }[];
  equipment: FilterOption[];
  movementPatterns: FilterOption[];
  /** How many exercises the current URL lists. */
  total: number;
  /** Signed-in shortcuts; `program` is false when no program is running. */
  lists?: { program: boolean } | null;
  /** Exercises without a movement pattern (the Movimento filter can't list them). */
  unclassifiedPatterns?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = useMemo(() => stateOf(searchParams), [searchParams]);
  const [pending, startTransition] = useTransition();
  // Chips and selects show the new choice at once while the list loads.
  const [shown, setShown] = useOptimistic(url);
  // The base for the next change: includes changes still in flight.
  const latest = useRef(url);
  useEffect(() => {
    latest.current = shown;
  }, [shown]);

  // The search box: typed freely, sent after a pause.
  const [text, setText] = useState(url.q);
  // Searches sent that the URL hasn't shown yet, oldest first.
  const [inFlight, setInFlight] = useState<string[]>([]);
  const [seenQ, setSeenQ] = useState(url.q);
  if (url.q !== seenQ) {
    setSeenQ(url.q);
    const at = inFlight.indexOf(url.q);
    if (at === -1) {
      // Moved by something else (Back, a link): the box follows.
      setText(url.q);
      setInFlight([]);
    } else {
      setInFlight(inFlight.slice(at + 1));
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const [moreOpen, setMoreOpen] = useState(Boolean(url.movementPatternId || url.difficulty));

  function navigate(patch: Partial<LibraryState>) {
    const next = { ...latest.current, ...patch };
    if (!lists) next.lista = "";
    latest.current = next;
    startTransition(() => {
      setShown(next);
      router.replace(libraryHref(pathname, next) as Route, { scroll: false });
    });
  }

  /** The typed text, if it isn't what the list shows yet (cancels the pending send). */
  function unsentText(): Partial<LibraryState> {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const q = text.trim();
    if (q === latest.current.q) return {};
    setInFlight((list) => [...list, q]);
    return { q };
  }

  function sendText() {
    const patch = unsentText();
    if (patch.q !== undefined) navigate(patch);
  }

  function type(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const q = value.trim();
      if (q === latest.current.q) return;
      setInFlight((list) => [...list, q]);
      navigate({ q });
    }, SEARCH_DEBOUNCE_MS);
  }

  function choose(key: Exclude<keyof LibraryState, "q">, value: string) {
    navigate({ ...unsentText(), [key]: value });
  }

  function clearAll() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setText("");
    if (latest.current.q) setInFlight((list) => [...list, ""]);
    navigate(EMPTY);
  }

  const busy = pending || text.trim() !== url.q;
  // Signed out there are no lists: a stray ?lista= filters nothing, so it isn't counted or carried.
  const facetKeys = LIBRARY_KEYS.filter((k) => k !== "q" && (lists || k !== "lista"));
  const onFacets = facetKeys.filter((k) => shown[k]);
  const filtersOn = text.trim() !== "" || onFacets.length > 0;
  const hiddenOn = (shown.movementPatternId ? 1 : 0) + (shown.difficulty ? 1 : 0);
  const facetsOn = onFacets.length;
  const searching = text.trim() !== "" || shown.q !== "";

  return (
    <div>
      {/* Without JavaScript the form still searches (a plain GET keeping the other filters). */}
      <form
        role="search"
        action={pathname}
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
          // Enter is "done": drop the keyboard so the results show.
          e.currentTarget.querySelector("input")?.blur();
        }}
        className="relative"
      >
        <label htmlFor="exercise-search" className="sr-only">
          Buscar exercício
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          id="exercise-search"
          name="q"
          type="search"
          value={text}
          onChange={(e) => type(e.target.value)}
          placeholder="Buscar exercício (ex.: supino, agachamento, tríceps)"
          autoComplete="off"
          // one clear button: ours (the browser's own sat next to it)
          className="pl-10 pr-11 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {onFacets.map((k) => (
          <input key={k} type="hidden" name={k} value={shown[k]} />
        ))}
        {text ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
              }
              if (latest.current.q) {
                setInFlight((list) => [...list, ""]);
                navigate({ q: "" });
              }
              document.getElementById("exercise-search")?.focus();
            }}
            className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </form>

      {/* gap-3: each chip's tap area reaches 6 px past it, so the rows need 12 px
          between them or the lower row takes taps meant for the one above. */}
      <div className="mt-4 flex flex-col gap-3">
        <FacetRow label="Músculo">
          <Chip on={!shown.muscleGroup} onClick={() => choose("muscleGroup", "")}>
            Todos
          </Chip>
          {muscleGroups.map((g) => (
            <Chip
              key={g.group}
              on={shown.muscleGroup === g.group}
              onClick={() => choose("muscleGroup", shown.muscleGroup === g.group ? "" : g.group)}
            >
              {g.namePt}
            </Chip>
          ))}
        </FacetRow>
        {lists ? (
          <FacetRow label="Lista">
            {LIBRARY_LISTS.filter((l) => l.value !== "programa" || lists.program || shown.lista === "programa").map((l) => (
              <Chip key={l.value} on={shown.lista === l.value} onClick={() => choose("lista", shown.lista === l.value ? "" : l.value)}>
                {l.label}
              </Chip>
            ))}
          </FacetRow>
        ) : null}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="exercise-equipment" className={MICRO}>
            Equipamento
          </label>
          <Select
            id="exercise-equipment"
            value={shown.equipmentId}
            onChange={(e) => choose("equipmentId", e.target.value)}
            className="mt-1"
          >
            <option value="">Todos</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.namePt}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="exercise-more-filters"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "h-11 shrink-0 border-b-2 px-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
            moreOpen || hiddenOn > 0
              ? "border-b-accent bg-[var(--ink-4)] text-foreground"
              : "border-b-foreground/50 bg-[var(--ink-3)] text-foreground hover:border-b-accent",
          )}
        >
          Mais filtros{hiddenOn > 0 ? <span className="text-accent"> · {hiddenOn}</span> : null}
        </button>
      </div>

      <div id="exercise-more-filters" hidden={!moreOpen} className="mt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label htmlFor="exercise-pattern" className={MICRO}>
              Movimento
            </label>
            <Select
              id="exercise-pattern"
              value={shown.movementPatternId}
              onChange={(e) => choose("movementPatternId", e.target.value)}
              className="mt-1"
            >
              <option value="">Todos</option>
              {movementPatterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namePt}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label htmlFor="exercise-level" className={MICRO}>
              Nível
            </label>
            <Select
              id="exercise-level"
              value={shown.difficulty}
              onChange={(e) => choose("difficulty", e.target.value)}
              className="mt-1"
            >
              <option value="">Todos</option>
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {unclassifiedPatterns > 0 ? (
          <p className="mt-2 text-xs text-muted">
            Movimento lista só os exercícios já classificados:{" "}
            {plural(unclassifiedPatterns, "exercício ainda não tem", "exercícios ainda não têm")} padrão e fica
            {unclassifiedPatterns === 1 ? "" : "m"} de fora com este filtro.
          </p>
        ) : null}
      </div>

      {filtersOn ? (
        <p className="mt-3 flex min-h-6 flex-wrap items-center gap-x-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          <span>{[text.trim() ? "busca" : null, facetsOn > 0 ? plural(facetsOn, "filtro", "filtros") : null].filter(Boolean).join(" + ")}</span>
          <span aria-hidden>·</span>
          <button type="button" onClick={clearAll} className="hit uppercase text-accent hover:underline">
            Limpar filtros
          </button>
        </p>
      ) : null}

      <SectionHead
        className="mt-6"
        // Short enough to share one row with "753 exercícios" at 320px.
        label={searching || filtersOn ? "Resultados" : "Biblioteca"}
        count={busy ? "Buscando…" : plural(total, "exercício", "exercícios")}
      />
      <p aria-live="polite" className="sr-only">
        {busy ? "" : plural(total, "exercício encontrado", "exercícios encontrados")}
      </p>
      <div
        aria-busy={busy || undefined}
        data-results-busy={busy || undefined}
        className={cn("transition-opacity duration-150", busy && "opacity-50")}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * One facet: a mono label, then its chips in a row that scrolls sideways
 * inside itself on a phone. A fade on the right edge says there is more
 * (until the end is reached), and a chip picked off-screen (from a link, after
 * Back) is scrolled into view.
 */
function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const picked = el.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (picked && picked.offsetLeft + picked.offsetWidth > el.clientWidth) el.scrollLeft = picked.offsetLeft - 8;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div role="group" aria-label={label} className="flex min-w-0 items-center gap-2">
      <span aria-hidden className={cn(MICRO, "w-16 shrink-0")}>
        {label}
      </span>
      <div className="relative min-w-0 flex-1">
        <div
          ref={row}
          onScroll={(e) => {
            const el = e.currentTarget;
            setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
          }}
          className="-my-1.5 flex gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-150",
            more ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}

/** A square filter chip: inked when on. Its touch target is 44px tall (.hit). */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "hit h-8 shrink-0 whitespace-nowrap px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors",
        on ? "bg-foreground text-background" : "bg-surface-2 text-foreground/75 hover:bg-[var(--border)] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
