import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import { GArrow, GLoad } from "@/components/ui/glyph";
import { Markdown } from "@/components/markdown";
import { SectionHead } from "@/components/ui/section-head";
import {
  EQUIPMENT_LABEL,
  EQUIPMENT_SHORT_LABEL,
  EXPERIENCE_LABEL,
  GOAL_HUE,
  GOAL_LABEL,
  STYLE_LABEL,
} from "@/lib/constants/program-labels";
import { joinPt, needLabels } from "@/lib/programming/equipment-needs";
import { glossaryFor } from "@/lib/programming/glossary";
import { formatNumber, formatRir, plural, pluralWord } from "@/lib/utils/format";
import { seriesLevelLabel, splitSeriesTagline, type SeriesBlock } from "@/lib/programming/gd-series";
import { deriveGroups, groupRule } from "@/lib/programming/groups";
import { isTimedHold } from "@/lib/training/set-plan";
import { cn } from "@/lib/utils/cn";
import { formatRestClock } from "@/lib/validation/program-builder-constants";
import { OpenSectionsOnHash, StickyActionsBar } from "./dossier-client";
import { SeriesRail } from "./gd-series-rail";

/** A close alternative listed under "Parecidos" (and in the compare table). */
export interface SimilarProgram {
  slug: string;
  namePt: string;
  href: string;
  goal: string;
  experienceLevel: string;
  trainingStyle: string;
  equipmentAccess: string;
  daysPerWeek: number;
  durationWeeks: number;
  sessionMinutes: number;
}

/** A GD block's place in the series, for its dossier's rail and prev/next links. */
export interface DossierSeries {
  blocks: SeriesBlock[];
  /** This dossier's block. */
  current: string;
}

interface DossierTemplate {
  namePt: string;
  taglinePt: string;
  audiencePt: string;
  descriptionPt: string;
  rationalePt: string;
  restGuidancePt: string | null;
  goal: string;
  experienceLevel: string;
  trainingStyle: string;
  equipmentAccess?: string;
  daysPerWeek: number;
  durationWeeks: number;
  sessionMinutes: number;
  progressionStrategy: string;
  isFlagship: boolean;
  weeklyGuidance: unknown;
  days: {
    id: string;
    namePt: string;
    focusPt: string | null;
    estimatedMinutes: number | null;
    exercises: {
      id: string;
      sets: number;
      repMin: number;
      repMax: number;
      rirTarget: number | null;
      restSeconds: number;
      warmupSets: number;
      notesPt?: string | null;
      /** A superset's key (W-104): adjacent exercises sharing one alternate their sets. */
      groupKey?: string | null;
      exercise: { namePt: string; slug: string; equipmentId?: string | null; media?: { url: string }[] };
    }[];
  }[];
  evidence: { sourceId: string; source: { url: string; title: string; journal: string; publicationYear: number } }[];
  principles: { principleId: string; principle: { slug: string; titlePt: string } }[];
}

/** A workout template's page. First what it is and what it asks each week
 * (days, minutes, weeks, level, split, where), the action to start and who
 * it's for; then a jump nav, the sessions — each exercise's name and
 * instructions apart from its sets × reps, RIR, rest and warm-up — the weekly
 * progression as a compact sequence (details one tap down), and the
 * description and science folded away. `actions` is the masthead CTA
 * (start/customize in-app, or login on the public page); `stickyActions`,
 * when given, floats them over the bottom of the (very tall) page, just above
 * the mobile nav, once the masthead's own buttons have scrolled away. `note`
 * sits right above the plan (the user's own limitations note). `scienceHref`
 * prefixes principle links and `exerciseHref` the exercise technique pages
 * each plan row opens. `series`, for a GD block, adds the series rail with
 * the blocks before and after it ("Bloco 3 de 9 · faça antes: GD 2"). */
export function TemplateDossier({
  template,
  actions,
  stickyActions,
  note,
  adapt,
  similar = [],
  scienceHref,
  exerciseHref = "/exercises",
  series,
}: {
  template: DossierTemplate;
  actions: React.ReactNode;
  stickyActions?: React.ReactNode;
  note?: React.ReactNode;
  /** Under the masthead: this program needs gear the user lacks — "Adaptar para halteres". */
  adapt?: React.ReactNode;
  /** "Parecidos": close alternatives, compared side by side. */
  similar?: SimilarProgram[];
  scienceHref: string;
  exerciseHref?: string;
  series?: DossierSeries | null;
}) {
  const hue = GOAL_HUE[template.goal] ?? GOAL_HUE.GENERAL_FITNESS;
  // A GD tagline leads with what the block builds; its place goes to the series line.
  const tagline = splitSeriesTagline(template.taglinePt);
  const weekly = Array.isArray(template.weeklyGuidance)
    ? (template.weeklyGuidance as Array<{ week: number; rirTarget: number | null; setsNotePt: string; notePt?: string }>)
    : [];
  const exercises = template.days.flatMap((d) => d.exercises);
  // Supersets (W-104): each day's groups, lettered A, B… in order.
  const daySlots = template.days.map((d) => deriveGroups(d.exercises.map((ex) => ({ groupKey: ex.groupKey ?? null }))));
  const glossary = glossaryFor(exercises.map((ex) => ex.notesPt));
  // "Requer: máquinas, cabos e barra" — what the exercises actually use.
  const needs = needLabels(exercises.map((ex) => ex.exercise.equipmentId ?? "").filter(Boolean));
  const equipment = template.equipmentAccess ?? null;

  const levelLabel = seriesLevelLabel(series?.current ?? "", template.experienceLevel);
  // The weekly demand, read before anything else: how often, how long, for how long, who, where.
  const demand: { label: string; value: string }[] = [
    { label: "Frequência", value: `${template.daysPerWeek} ${pluralWord(template.daysPerWeek, "dia", "dias")}/semana` },
    { label: "Sessão", value: `~${template.sessionMinutes} min` },
    { label: "Duração", value: plural(template.durationWeeks, "semana", "semanas") },
    { label: "Nível", value: levelLabel },
    { label: "Divisão", value: STYLE_LABEL[template.trainingStyle] ?? "Programa" },
    ...(equipment ? [{ label: "Onde", value: EQUIPMENT_LABEL[equipment] ?? equipment }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <OpenSectionsOnHash />
      {/* Masthead: what it is, the weekly demand, how to start, then who it's for. */}
      <div className="panel @container p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="tag tag--field text-[13px]" style={{ color: hue.fg }}>
            {GOAL_LABEL[template.goal] ?? template.goal}
          </span>
          {template.isFlagship ? <span className="tag tag--mark">Destaque</span> : null}
        </div>
        <h1 className="text-display mt-2 text-[1.75rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[2rem]">
          {template.namePt}
        </h1>
        {tagline.meta && !series ? <p className="mt-1.5 text-[13px] font-medium text-muted">{tagline.meta}</p> : null}
        <p className="mt-2 text-[15px] leading-relaxed text-muted wrap-break-word sm:text-base">{tagline.outcome}</p>

        {/* Three across once the panel itself is wide enough (it is narrow beside the sidebar on a tablet). */}
        <dl className="mt-5 grid grid-cols-2 gap-2 @lg:grid-cols-3">
          {demand.map((d) => (
            <div key={d.label} className="min-w-0 rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5">
              <dt className="text-[13px] text-muted">{d.label}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold leading-snug tabular-nums wrap-break-word">{d.value}</dd>
            </div>
          ))}
        </dl>
        {exercises.length > 0 ? (
          <p className="mt-3 text-[13px] text-muted" data-testid="dossier-requires">
            {needs.length > 0 ? (
              <>
                Requer: <span className="font-medium text-foreground">{joinPt(needs)}</span>
              </>
            ) : (
              "Só o peso do corpo"
            )}
          </p>
        ) : null}

        <div id="dossier-actions" className="mt-5 flex flex-wrap gap-2">
          {actions}
        </div>

        <section aria-labelledby="dossier-audience" className="mt-6 border-t border-border pt-5">
          <h2 id="dossier-audience" className="text-[15px] font-semibold">
            Para quem é
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-foreground/90">{template.audiencePt}</p>
        </section>

        {series ? <SeriesPlace series={series} /> : null}
      </div>

      {adapt}

      {note}

      {/* Jump nav — reach any part of the plan without scrolling the prose. Each link
          is a 44px target around its pill. */}
      <nav aria-label="Seções" className="mt-6 flex flex-wrap gap-2">
        <JumpLink href="#estrutura">Estrutura</JumpLink>
        {weekly.length > 0 ? <JumpLink href="#progressao">Progressão</JumpLink> : null}
        <JumpLink href="#descricao">Descrição</JumpLink>
        <JumpLink href="#ciencia">Ciência</JumpLink>
        {similar.length > 0 ? <JumpLink href="#parecidos">Parecidos</JumpLink> : null}
      </nav>

      {/* The sessions — the actual plan, kept expanded and high on the page */}
      <section id="estrutura" className="mt-8 scroll-mt-4">
        <SectionHead label="Estrutura semanal" count={plural(template.days.length, "treino", "treinos")} />
        <PlanLegend exercises={exercises} rirHref={`${scienceHref}/rir`} />
        {glossary.length > 0 ? (
          <details className="group mt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              Termos deste plano ({glossary.length})
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <dl className="flex flex-col gap-2 pb-3 text-[13px] leading-snug">
              {glossary.map((g) => (
                <div key={g.term}>
                  <dt className="inline font-semibold">{g.term}</dt>
                  <dd className="inline text-muted"> — {g.meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
        <div className="mt-4 flex flex-col gap-4">
          {template.days.map((day, i) => (
            <div key={day.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border px-4 py-3 sm:px-5">
                <h3 className="min-w-0 text-base font-semibold leading-snug wrap-break-word">
                  {day.namePt}
                </h3>
                <span className="shrink-0 text-[13px] tabular-nums text-muted">
                  {day.estimatedMinutes ? `~${day.estimatedMinutes} min · ` : ""}
                  {plural(day.exercises.length, "exercício", "exercícios")}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {day.exercises.map((ex, j) => {
                  const slot = daySlots[i][j];
                  // A mobility hold logs seconds, not reps (set-plan isTimedHold): print "3×30 s".
                  const timed = isTimedHold({ slug: ex.exercise.slug, notes: ex.notesPt });
                  // A superset member's rest is where it goes: the switch to the next one, or the rest after the round.
                  const rest = slot
                    ? slot.last
                      ? `${formatRestClock(ex.restSeconds)} após a rodada`
                      : `${formatRestClock(ex.restSeconds)} até ${slot.key}${slot.position + 1}`
                    : ex.restSeconds > 0
                      ? `Descanso ${formatRestClock(ex.restSeconds)}`
                      : null;
                  return (
                    <li key={ex.id} data-group={slot?.label} className={cn(slot && "bg-accent-soft/40")}>
                      {slot?.first ? (
                        <p className="px-4 pt-3 text-[13px] font-semibold text-accent sm:px-5">{groupRule(slot)}</p>
                      ) : null}
                      <Link
                        href={`${exerciseHref}/${ex.exercise.slug}`}
                        className="group flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--ink-2)] sm:px-5"
                      >
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
                          {ex.exercise.media?.[0]?.url ? (
                            <Image
                              src={ex.exercise.media[0].url}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted">
                              <GLoad className="size-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium leading-snug wrap-break-word group-hover:text-accent">
                            {slot ? (
                              <span className="mr-1.5 font-semibold tabular-nums text-accent">
                                <span aria-hidden>{slot.label}</span>
                                <span className="sr-only">{`${slot.heading}, ${slot.position} de ${slot.size}:`}</span>
                              </span>
                            ) : null}
                            {ex.exercise.namePt}
                          </span>
                          {/* The prescription, apart from the name: sets × reps, effort, rest, warm-up. */}
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="tag tag--spec font-semibold">
                              {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                              {timed ? " s" : ""}
                            </span>
                            {ex.rirTarget != null ? <span className="tag tag--spec">{formatRir(ex.rirTarget)}</span> : null}
                            {rest ? <span className="tag tag--spec">{rest}</span> : null}
                            {ex.warmupSets > 0 ? <span className="tag tag--spec">+{ex.warmupSets} aquec.</span> : null}
                          </span>
                          {ex.notesPt ? <p className="mt-1.5 text-[13px] leading-snug text-muted">{ex.notesPt}</p> : null}
                        </div>
                        <GArrow className="mt-1 size-4 shrink-0 self-start text-muted transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly progression: the effort week by week at a glance, what changes one tap down. */}
      {weekly.length > 0 ? (
        <section id="progressao" className="mt-10 scroll-mt-4">
          <SectionHead label="Progressão semana a semana" count={plural(weekly.length, "semana", "semanas")} />
          <ol
            className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5"
            aria-label="Esforço alvo por semana"
          >
            {weekly.map((w) => (
              <li key={w.week} className="rounded-[var(--radius-md)] bg-surface-2 px-2.5 py-2">
                <span className="block text-xs text-muted">Sem. {w.week}</span>
                <span className="block text-sm font-semibold tabular-nums">
                  {w.rirTarget != null ? `RIR ~${formatNumber(w.rirTarget)}` : "—"}
                </span>
              </li>
            ))}
          </ol>
          <details className="group card mt-3">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
              O que muda em cada semana
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="flex flex-col divide-y divide-border border-t border-border">
              {weekly.map((w) => (
                <li key={w.week} className="flex gap-3 px-4 py-3 sm:px-5">
                  <span className="w-20 shrink-0 text-[13px] font-semibold tabular-nums">
                    Semana {w.week}
                    {w.rirTarget != null ? (
                      <span className="block font-normal text-accent">RIR ~{formatNumber(w.rirTarget)}</span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-foreground/90">{w.setsNotePt}</span>
                    {w.notePt ? <span className="mt-0.5 block text-[13px] leading-snug text-muted">{w.notePt}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </details>
          {template.restGuidancePt ? (
            <p className="mt-3 rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-sm leading-snug text-muted">
              <span className="font-semibold text-foreground">Descanso.</span> {template.restGuidancePt}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-10 flex flex-col gap-3">
        <CollapsibleSection title="Descrição" id="descricao">
          <Markdown text={template.descriptionPt} />
        </CollapsibleSection>

        {/* Science */}
        <CollapsibleSection title="Base científica" id="ciencia">
          <Markdown text={template.rationalePt} />
          {template.evidence.length > 0 ? (
            <ul className="mt-4 flex flex-col divide-y divide-border rounded-[var(--radius-md)] border border-border">
              {template.evidence.map((ev) => (
                <li key={ev.sourceId}>
                  <a
                    href={ev.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-[var(--ink-2)]"
                  >
                    <span className="min-w-0">
                      <span lang="en" className="line-clamp-1">{ev.source.title}</span>
                      <span className="text-[13px] text-muted">
                        {ev.source.journal}, {ev.source.publicationYear}
                      </span>
                    </span>
                    <ExternalLink aria-hidden className="size-4 shrink-0 text-muted" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {template.principles.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {template.principles.map((tp) => (
                <Link
                  key={tp.principleId}
                  href={`${scienceHref}/${tp.principle.slug}`}
                  className="hit inline-flex h-9 items-center rounded-[var(--radius-md)] bg-accent-soft px-3 text-[13px] font-medium text-accent hover:underline"
                >
                  {tp.principle.titlePt}
                </Link>
              ))}
            </div>
          ) : null}
        </CollapsibleSection>
      </div>

      {similar.length > 0 ? (
        <SimilarSection
          current={{
            slug: "",
            namePt: template.namePt,
            href: "",
            goal: template.goal,
            experienceLevel: template.experienceLevel,
            trainingStyle: template.trainingStyle,
            equipmentAccess: equipment ?? "FULL_GYM",
            daysPerWeek: template.daysPerWeek,
            durationWeeks: template.durationWeeks,
            sessionMinutes: template.sessionMinutes,
          }}
          similar={similar}
        />
      ) : null}

      {stickyActions ? <StickyActionsBar watchId="dossier-actions">{stickyActions}</StickyActionsBar> : null}
    </div>
  );
}

function JumpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="hit inline-flex h-9 items-center rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      {children}
    </a>
  );
}

/** "4×/semana · 8 semanas · 60 min" — a program's spec in one line (for screen readers). */
function specLine(t: SimilarProgram) {
  return `${t.daysPerWeek}×/semana · ${plural(t.durationWeeks, "semana", "semanas")} · ${t.sessionMinutes} min`;
}

/**
 * "Parecidos": close alternatives (same goal, nearby level) as compact spec
 * rows, what differs in bold, and a side-by-side table for anyone torn
 * between them — no more opening three dossiers and remembering numbers.
 */
function SimilarSection({ current, similar }: { current: SimilarProgram; similar: SimilarProgram[] }) {
  const columns = [current, ...similar];
  const rows: { label: string; value: (t: SimilarProgram) => string }[] = [
    { label: "Nível", value: (t) => EXPERIENCE_LABEL[t.experienceLevel] ?? t.experienceLevel },
    { label: "Treinos", value: (t) => `${t.daysPerWeek}× / semana` },
    { label: "Duração", value: (t) => plural(t.durationWeeks, "semana", "semanas") },
    { label: "Sessão", value: (t) => `${t.sessionMinutes} min` },
    { label: "Divisão", value: (t) => STYLE_LABEL[t.trainingStyle] ?? t.trainingStyle },
    { label: "Onde", value: (t) => EQUIPMENT_SHORT_LABEL[t.equipmentAccess] ?? t.equipmentAccess },
  ];
  const differs = (t: SimilarProgram, key: "daysPerWeek" | "durationWeeks" | "sessionMinutes" | "equipmentAccess") =>
    t[key] !== current[key];
  return (
    <section id="parecidos" className="mt-10 scroll-mt-4" data-testid="dossier-similar">
      <SectionHead label="Parecidos" count={String(similar.length)} />
      <p className="mt-1 text-[13px] text-muted">Mesmo objetivo e nível próximo — em destaque, o que muda.</p>
      <ul className="card mt-3 flex flex-col divide-y divide-border overflow-hidden">
        {similar.map((t) => (
          <li key={t.slug}>
            <Link href={t.href} className="group flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-[var(--ink-2)] sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug group-hover:text-accent">{t.namePt}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-1.5 text-[13px] tabular-nums text-muted">
                  <span className={differs(t, "daysPerWeek") ? "font-semibold text-foreground" : undefined}>
                    {t.daysPerWeek}×/semana
                  </span>
                  <span aria-hidden>·</span>
                  <span className={differs(t, "durationWeeks") ? "font-semibold text-foreground" : undefined}>
                    {t.durationWeeks} sem
                  </span>
                  <span aria-hidden>·</span>
                  <span className={differs(t, "sessionMinutes") ? "font-semibold text-foreground" : undefined}>
                    {t.sessionMinutes} min
                  </span>
                  <span aria-hidden>·</span>
                  <span className={differs(t, "equipmentAccess") ? "font-semibold text-foreground" : undefined}>
                    {EQUIPMENT_SHORT_LABEL[t.equipmentAccess] ?? t.equipmentAccess}
                  </span>
                  <span className="sr-only">({specLine(t)})</span>
                </span>
              </span>
              <GArrow className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
      <details className="group mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Comparar lado a lado
          <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        {/* Scrolls sideways inside itself on a phone, never the page. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[34rem] border-collapse text-left text-[13px]">
            <caption className="sr-only">Este programa comparado com os parecidos</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className="w-20 py-2 pr-2">
                  <span className="sr-only">Item</span>
                </th>
                {columns.map((t, i) => (
                  <th key={t.slug || "current"} scope="col" className="px-2 py-2 align-bottom font-semibold leading-snug">
                    {i === 0 ? (
                      <>
                        <span className="block text-xs font-medium text-accent">Este</span>
                        {t.namePt}
                      </>
                    ) : (
                      <Link href={t.href} className="hover:text-accent hover:underline">
                        {t.namePt}
                      </Link>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border">
                  <th scope="row" className="py-2 pr-2 font-medium text-muted">
                    {row.label}
                  </th>
                  {columns.map((t, i) => {
                    const value = row.value(t);
                    return (
                      <td
                        key={t.slug || "current"}
                        className={`px-2 py-2 tabular-nums ${i > 0 && value !== row.value(current) ? "font-semibold text-foreground" : "text-foreground/80"}`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/**
 * "Plano GD · Bloco 3 de 9 · faça antes: GD 2", the series rail with this
 * block marked, and the blocks before and after it.
 */
function SeriesPlace({ series }: { series: DossierSeries }) {
  const at = series.blocks.findIndex((b) => b.slug === series.current);
  if (at < 0) return null;
  const block = series.blocks[at];
  const prev = at > 0 ? series.blocks[at - 1] : null;
  const next = at < series.blocks.length - 1 ? series.blocks[at + 1] : null;
  const link = "font-semibold text-accent underline decoration-1 underline-offset-2 hover:decoration-2";
  return (
    <div className="mt-6 border-t border-border pt-5" data-series-place>
      <p className="text-[15px] font-semibold">
        Plano GD · Bloco {at + 1} de {series.blocks.length}
        {prev ? (
          <>
            {" · "}
            <span className="whitespace-nowrap font-normal text-muted">
              faça antes:{" "}
              <Link href={prev.href} className={link}>
                {prev.name}
              </Link>
            </span>
          </>
        ) : (
          <span className="font-normal text-muted"> · o início do plano</span>
        )}
      </p>
      <p className="mt-0.5 text-[13px] tabular-nums text-muted">
        Semanas {block.fromWeek}–{block.toWeek} de {series.blocks[series.blocks.length - 1].toWeek}
      </p>
      {at === 1 && prev ? (
        <p className="mt-1.5 text-[13px] text-muted">Já treina com boa técnica? Dá para começar o plano por aqui.</p>
      ) : null}
      <SeriesRail blocks={series.blocks} current={series.current} className="mt-4" />
      {/* Each link stays on one line ("GD Adaptação", "Depois: GD 2"); when both don't
          fit side by side (320 px), the next one moves under the first, still on the right. */}
      <nav aria-label="Blocos do Plano GD" className="mt-3 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        {prev ? (
          <Link href={prev.href} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap font-semibold hover:text-accent">
            <ArrowLeft className="size-4" aria-hidden />
            {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={next.href}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap text-right font-semibold hover:text-accent"
          >
            Depois: {next.name}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className="ml-auto text-[13px] text-muted">Último bloco</span>
        )}
      </nav>
    </div>
  );
}

/**
 * One line that reads the plan's notation, using this plan's own first
 * prescription: "3×8-12 = 3 séries de 8 a 12 reps · RIR 2 = pare com ~2 reps
 * sobrando · +1 aquec. = 1 série leve antes".
 */
function PlanLegend({
  exercises,
  rirHref,
}: {
  exercises: { sets: number; repMin: number; repMax: number; rirTarget: number | null; warmupSets: number }[];
  rirHref: string;
}) {
  const ex = exercises.find((e) => e.rirTarget != null) ?? exercises[0];
  if (!ex) return null;
  const reps = ex.repMin === ex.repMax ? `${ex.repMin}` : `${ex.repMin}-${ex.repMax}`;
  const repsText = ex.repMin === ex.repMax ? `${ex.repMin} reps` : `${ex.repMin} a ${ex.repMax} reps`;
  const rir = exercises.find((e) => e.rirTarget != null)?.rirTarget ?? null;
  const warmup = exercises.find((e) => e.warmupSets > 0)?.warmupSets ?? 0;
  const code = (s: string) => <span className="font-semibold tabular-nums text-foreground">{s}</span>;
  return (
    <p className="mt-3 rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted">
      <span className="mr-1 font-semibold text-foreground">Como ler:</span>
      {code(`${ex.sets}×${reps}`)} = {plural(ex.sets, "série", "séries")} de {repsText}
      {rir != null ? (
        <>
          {" · "}
          {code(formatRir(rir))} = pare com ~{formatNumber(rir)} {pluralWord(rir, "rep", "reps")} sobrando
        </>
      ) : null}
      {warmup > 0 ? (
        <>
          {" · "}
          {code(`+${warmup} aquec.`)} = {plural(warmup, "série leve", "séries leves")} antes
        </>
      ) : null}
      {rir != null ? (
        <>
          {" · "}
          <Link href={rirHref} className="whitespace-nowrap font-semibold text-accent hover:underline">
            Entenda o RIR →
          </Link>
        </>
      ) : null}
    </p>
  );
}

/** A prose section that collapses (default closed), so the sessions and weekly
 * plan lead the page instead of a multi-thousand-pixel wall. A calm card whose
 * whole title row toggles it, with a chevron that turns when open. */
function CollapsibleSection({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group card scroll-mt-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-semibold">{title}</span>
        <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">{children}</div>
    </details>
  );
}
