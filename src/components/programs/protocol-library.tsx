"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SectionHead } from "@/components/ui/section-head";
import { ProtocolCard, type ProtocolCardData } from "@/components/programs/protocol-card";
import { EXPERIENCE_LABEL, GOAL_LABEL, STYLE_LABEL } from "@/lib/constants/program-labels";
import { normalizeText } from "@/lib/utils/normalize-text";

/** Every word a person might type to find a protocol: its name, tagline, labels, frequency and length. */
function searchTextFor(item: ProtocolCardData): string {
  return normalizeText(
    [
      item.namePt,
      ...item.dayNames,
      item.taglinePt,
      GOAL_LABEL[item.goal],
      EXPERIENCE_LABEL[item.experienceLevel],
      STYLE_LABEL[item.trainingStyle],
      `${item.durationWeeks} semanas`,
    ]
      .join(" ")
      .replace(/×/g, "x"), // "5×5" is typed as "5x5"
  );
}

/** A number must match as a whole number ("4" finds "4 dias", not "14" or "44"); words match anywhere. */
function matches(text: string, term: string): boolean {
  if (!/^\d+$/.test(term)) return text.includes(term);
  return new RegExp(`(^|\\D)${term}(\\D|$)`).test(text);
}

/**
 * The protocol library with a search bar on top. Filtering is instant and
 * client-side (every word must match, accents ignored). `children` — e.g. the
 * user's own programs — render between the search bar and the library and are
 * hidden while a search is active, so results sit right under the bar.
 */
export function ProtocolLibrary({
  label,
  items,
  children,
}: {
  label: string;
  items: ProtocolCardData[];
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const indexed = useMemo(() => items.map((item) => ({ item, text: searchTextFor(item) })), [items]);
  const normalized = normalizeText(query);
  // "4 dias", "4x" or "4 vezes" means training days per week, not any "4" in the text.
  const days = /(\d+)\s*(?:x|dias?|vezes)\b/.exec(normalized);
  const terms = (days ? normalized.replace(days[0], " ") : normalized).split(/\s+/).filter(Boolean);
  const phrase = normalized.trim().replace(/\s+/g, " ");
  const visible = indexed
    .filter(({ item, text }) => (!days || item.daysPerWeek === Number(days[1])) && terms.every((t) => matches(text, t)))
    // a program whose name contains the whole query ("GD 1") comes first; order is otherwise kept
    .sort(
      (a, b) =>
        Number(!normalizeText(a.item.namePt).includes(phrase)) - Number(!normalizeText(b.item.namePt).includes(phrase)),
    );
  const searching = normalized.trim().length > 0;

  return (
    <>
      <div className="relative mt-8">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          id="program-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar programa (ex.: GD, hipertrofia, 4 dias, iniciante)"
          aria-label="Buscar programa"
          className="pl-10 pr-10"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-muted hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {searching ? null : children}

      <section className={searching ? "mt-8" : "mt-14"}>
        <SectionHead label={label} count={searching ? `${visible.length} de ${items.length}` : `${items.length}`} />
        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nenhum programa encontrado para “{query.trim()}”. Tente outro termo, como o objetivo, o nível ou o número de
            dias.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {visible.map(({ item }) => (
              <ProtocolCard key={item.href} data={item} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
