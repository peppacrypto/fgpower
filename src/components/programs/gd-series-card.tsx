"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { GOAL_HUE } from "@/lib/constants/program-labels";
import { seriesBlocks, splitSeriesTagline, type SeriesBlock } from "@/lib/programming/gd-series";
import { cn } from "@/lib/utils/cn";
import type { ProtocolCardData } from "./protocol-card";
import { SeriesRail } from "./gd-series-rail";

/** Where the user stands in the series (program-lifecycle getSeriesContinuation). */
export interface SeriesProgress {
  /** Blocks finished: ✓ on the rail, "Concluído" in the list. */
  finished: readonly string[];
  /** The block after the furthest one finished: "Continuar: GD 2". */
  next: string | null;
  /** A block stopped mid-way, nothing running: "Retomar GD 1 · semana 7" (its program page). */
  resume: { slug: string; href: string; week: number } | null;
  /** The whole plan done (GD 8 finished): "Repetir GD 8" (the finished program's page), never the start again. */
  repeat?: { slug: string; href: string } | null;
}

/**
 * The GD plan as one card — "Plano GD · 2 anos" — instead of nine look-alike
 * cards: one line on what it is, a 9-segment rail (Adaptação, 1…8; width by
 * weeks, height by level, years under it; finished blocks ✓), the block to go
 * on with for this user — the running one, one stopped mid-way ("Retomar"),
 * the one after the last finished ("Continuar: GD 2"), the last one again
 * once the whole plan is done ("Repetir GD 8"), else where to start —
 * and the blocks themselves one tap away. `matches` (with the library
 * filtered) lists the blocks the chips kept: the rail marks them and the list
 * opens on them.
 */
export function GdSeriesCard({
  items,
  entry,
  running,
  progress = null,
  pick,
  matches,
}: {
  /** The library's cards; the GD blocks are taken from them (with their hrefs). */
  items: ProtocolCardData[];
  /** Where this user should start: "gd-adaptacao" (new to lifting) or "gd-1". */
  entry: string;
  /** The template the user is running, if it's a GD block. */
  running?: string | null;
  progress?: SeriesProgress | null;
  /** The user's top recommendation, if it's a GD block ("Para você"). */
  pick?: string | null;
  matches?: ReadonlySet<string> | null;
}) {
  const bySlug = new Map(items.map((t) => [t.slug, t]));
  const blocks = seriesBlocks(items, (slug) => bySlug.get(slug)?.href ?? "#");
  const [open, setOpen] = useState(matches != null);
  const listId = useId();
  if (blocks.length === 0) return null;

  const hue = GOAL_HUE[bySlug.get(blocks[0].slug)?.goal ?? ""] ?? GOAL_HUE.GENERAL_FITNESS;
  const totalWeeks = blocks[blocks.length - 1].toWeek;
  const runningBlock = blocks.find((b) => b.slug === running) ?? null;
  const finished = new Set(progress?.finished ?? []);
  const resumeBlock = runningBlock ? null : (blocks.find((b) => b.slug === progress?.resume?.slug) ?? null);
  const nextBlock = runningBlock || resumeBlock ? null : (blocks.find((b) => b.slug === progress?.next) ?? null);
  // The plan done (GD 8 finished), nothing to go on with: its last block is offered again.
  const repeatBlock =
    runningBlock || resumeBlock || nextBlock ? null : (blocks.find((b) => b.slug === progress?.repeat?.slug) ?? null);
  const start =
    runningBlock ??
    resumeBlock ??
    nextBlock ??
    repeatBlock ??
    blocks.find((b) => b.slug === pick) ??
    blocks.find((b) => b.slug === entry) ??
    blocks[0];
  const startHref =
    resumeBlock && progress?.resume
      ? progress.resume.href
      : repeatBlock && progress?.repeat
        ? progress.repeat.href
        : start.href;
  // The rail: finished blocks carry a ✓; the one to go on with is marked.
  const railBlocks = blocks.map((b) =>
    finished.has(b.slug) && b.slug !== runningBlock?.slug ? { ...b, short: "✓", name: `${b.name} (concluído)` } : b,
  );
  const years = [1, 2]
    .map((year) => ({ year, weeks: blocks.filter((b) => b.year === year).reduce((n, b) => n + b.durationWeeks, 0) }))
    .filter((y) => y.weeks > 0);
  const listed = matches ? blocks.filter((b) => matches.has(b.slug)) : blocks;
  // The weekly commitment, as the program cards say it: "5 dias/semana · ~45–62 min · 9 blocos".
  const blockItems = blocks.map((b) => bySlug.get(b.slug)).filter((t): t is ProtocolCardData => Boolean(t));
  const range = (values: number[]) => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  };
  const commitment =
    blockItems.length > 0
      ? `${range(blockItems.map((t) => t.daysPerWeek))} dias/semana · ~${range(blockItems.map((t) => t.sessionMinutes))} min · ${blocks.length} blocos`
      : null;
  const status = runningBlock
    ? `Seu programa · ${runningBlock.name}`
    : resumeBlock
      ? `Seu programa · ${resumeBlock.name}`
      : nextBlock
        ? `Próximo · ${nextBlock.name}`
        : repeatBlock
          ? "Plano concluído"
          : pick && blocks.some((b) => b.slug === pick)
            ? "Para você"
            : null;

  return (
    <div data-series="gd" className="card flex min-w-0 flex-col p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="tag tag--field text-[13px]" style={{ color: hue.fg }}>
            Série · {blocks.length} blocos
          </span>
          <h3 className="mt-1 text-xl font-semibold leading-tight">
            Plano GD <span className="font-normal text-muted">· {Math.round(totalWeeks / 52) || 1} anos</span>
          </h3>
        </div>
        {status ? <span className="tag tag--mark mt-0.5 shrink-0">{status}</span> : null}
      </div>
      <p className="mt-1.5 text-sm leading-snug text-muted">
        Um plano de 2 anos em blocos seguidos, 5×/semana: cada bloco prepara o próximo, com testes de força no caminho.
      </p>
      {commitment ? <p className="mt-3 text-sm font-medium tabular-nums">{commitment}</p> : null}

      <SeriesRail
        blocks={railBlocks}
        current={(runningBlock ?? resumeBlock ?? nextBlock ?? repeatBlock)?.slug ?? null}
        highlight={matches ?? null}
        years={years}
        className="mt-5"
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="strong" asChild className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left">
          <Link href={startHref}>
            {runningBlock
              ? `Ver seu bloco · ${runningBlock.name}`
              : resumeBlock && progress?.resume
                ? `Retomar ${resumeBlock.name} · ${progress.resume.week === 0 ? "semana de entrada" : `semana ${progress.resume.week}`}`
                : nextBlock
                  ? `Continuar: ${nextBlock.name}`
                  : repeatBlock
                    ? `Repetir ${repeatBlock.name}`
                    : start.slug === "gd-adaptacao"
                    ? "Começar pela Adaptação"
                    : `Começar pelo ${start.name}`}
            <GArrow className="size-4" />
          </Link>
        </Button>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="mt-5 flex min-h-11 w-full items-center justify-between gap-3 border-t border-border pt-1 text-left text-sm font-semibold text-accent hover:underline"
      >
        {open ? "Esconder os blocos" : matches ? `Ver os blocos (${listed.length} de ${blocks.length})` : `Ver os ${blocks.length} blocos`}
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {/* Hidden, not removed: every block stays a link for crawlers and page search. */}
      <ol id={listId} hidden={!open} className="mt-3 flex flex-col divide-y divide-border sm:mt-4">
        {listed.map((b) => (
          <BlockRow
            key={b.slug}
            block={b}
            tagline={bySlug.get(b.slug)?.taglinePt ?? ""}
            mark={
              b.slug === running
                ? "Seu programa"
                : b.slug === resumeBlock?.slug
                  ? "Retomar"
                  : finished.has(b.slug)
                    ? "Concluído"
                    : b.slug === nextBlock?.slug
                      ? "Próximo bloco"
                      : b.slug === start.slug
                        ? "Comece aqui"
                        : null
            }
          />
        ))}
      </ol>
    </div>
  );
}

function BlockRow({ block, tagline, mark }: { block: SeriesBlock; tagline: string; mark: string | null }) {
  const { outcome } = splitSeriesTagline(tagline);
  return (
    <li>
      <Link href={block.href} className="group flex items-start gap-3 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-sm font-semibold tabular-nums">
          {block.short}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold group-hover:text-accent">{block.name}</span>
            {mark ? <span className="tag tag--mark">{mark}</span> : null}
          </span>
          <span className="mt-0.5 block text-[13px] tabular-nums text-muted">
            Semanas {block.fromWeek}–{block.toWeek} · {block.durationWeeks} semanas · {block.levelLabel}
          </span>
          {outcome ? <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-muted wrap-break-word">{outcome}</span> : null}
        </span>
        <GArrow className="mt-2 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
