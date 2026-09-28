import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { GArrow, GLoad } from "@/components/ui/glyph";
import { Markdown } from "@/components/markdown";
import { SectionHead } from "@/components/ui/section-head";
import { GOAL_LABEL, STYLE_LABEL, GOAL_HUE, EQUIPMENT_LABEL } from "@/lib/constants/program-labels";
import { glossaryFor } from "@/lib/programming/glossary";
import { formatNumber, formatRir, plural, pluralWord } from "@/lib/utils/format";
import { seriesLevelLabel, splitSeriesTagline, type SeriesBlock } from "@/lib/programming/gd-series";
import { OpenSectionsOnHash, StickyActionsBar } from "./dossier-client";
import { SeriesRail } from "./gd-series-rail";

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
      exercise: { namePt: string; slug: string; media?: { url: string }[] };
    }[];
  }[];
  evidence: { sourceId: string; source: { url: string; title: string; journal: string; publicationYear: number } }[];
  principles: { principleId: string; principle: { slug: string; titlePt: string } }[];
}

/** A workout template rendered as a "training dossier" — masthead, jump nav, day
 * sheets with indexed exercises, a weekly progression timeline, and cited
 * evidence. Long prose sections (description, science) are collapsible so the
 * actual plan sits near the top. `actions` is the masthead CTA (start/customize
 * in-app, or login on the public page); `stickyActions`, when given, pins them
 * to the bottom of the (very tall) page, just above the mobile nav, once the
 * masthead's own buttons have scrolled away. `note` sits right above the plan
 * (the user's own limitations note). `scienceHref` prefixes principle links
 * and `exerciseHref` the exercise technique pages each plan row opens.
 * `series`, for a GD block, adds the series rail with the blocks before and
 * after it ("Bloco 3 de 9 · faça antes: GD 2"). */
export function TemplateDossier({
  template,
  actions,
  stickyActions,
  note,
  scienceHref,
  exerciseHref = "/exercises",
  series,
}: {
  template: DossierTemplate;
  actions: React.ReactNode;
  stickyActions?: React.ReactNode;
  note?: React.ReactNode;
  scienceHref: string;
  exerciseHref?: string;
  series?: DossierSeries | null;
}) {
  const hue = GOAL_HUE[template.goal] ?? GOAL_HUE.GENERAL_FITNESS;
  // A GD tagline leads with what the block builds; its place goes to the series line.
  const tagline = splitSeriesTagline(template.taglinePt);
  const weekly = Array.isArray(template.weeklyGuidance)
    ? (template.weeklyGuidance as Array<{ week: number; rirTarget: number; setsNotePt: string; notePt?: string }>)
    : [];
  const exercises = template.days.flatMap((d) => d.exercises);
  const glossary = glossaryFor(exercises.map((ex) => ex.notesPt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <OpenSectionsOnHash />
      {/* Masthead */}
      <div className="relative overflow-hidden panel-raised p-6 sm:p-8">
        <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: hue.spine }} aria-hidden />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {STYLE_LABEL[template.trainingStyle] ?? "Programa"}
          </span>
          <span className="tag tag--field" style={{ color: hue.fg }}>
            {GOAL_LABEL[template.goal] ?? template.goal}
          </span>
          <span className="tag tag--spec">{seriesLevelLabel(series?.current ?? "", template.experienceLevel)}</span>
          {template.equipmentAccess && template.equipmentAccess !== "FULL_GYM" ? (
            <span className="tag tag--spec">{EQUIPMENT_LABEL[template.equipmentAccess]}</span>
          ) : null}
          {template.isFlagship ? <span className="tag tag--mark">Destaque</span> : null}
        </div>
        <h1 className="text-display mt-2 text-3xl font-extrabold sm:text-4xl">{template.namePt}</h1>
        {tagline.meta && !series ? (
          <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{tagline.meta}</p>
        ) : null}
        <p className="mt-2 text-muted wrap-break-word">{tagline.outcome}</p>
        {series ? <SeriesPlace series={series} /> : null}

        <div className="mt-6 grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-center">
          <MastheadStat value={`${template.daysPerWeek}×`} label="/ semana" />
          <MastheadStat
            value={String(template.durationWeeks)}
            label={pluralWord(template.durationWeeks, "semana", "semanas")}
          />
          <MastheadStat value={`${template.sessionMinutes}′`} label="por sessão" />
        </div>

        <div id="dossier-actions" className="mt-6 flex flex-wrap gap-2">
          {actions}
        </div>
      </div>

      {/* Jump nav — reach the plan without scrolling the prose */}
      <nav aria-label="Seções" className="mt-4 flex flex-wrap gap-1.5">
        <a href="#estrutura" className="tag tag--mark hover:brightness-95">
          Estrutura
        </a>
        {weekly.length > 0 ? (
          <a href="#progressao" className="tag tag--mark hover:brightness-95">
            Progressão
          </a>
        ) : null}
        <a href="#descricao" className="tag tag--mark hover:brightness-95">
          Descrição
        </a>
        <a href="#ciencia" className="tag tag--mark hover:brightness-95">
          Ciência
        </a>
      </nav>

      <Section title="Para quem é">
        <p className="text-sm text-foreground/90">{template.audiencePt}</p>
      </Section>

      {note}

      {/* Day sheets — the actual plan, kept expanded and high on the page */}
      <section id="estrutura" className="mt-10 scroll-mt-4">
        <SectionHead label="Estrutura semanal" count={plural(template.days.length, "dia", "dias")} />
        <PlanLegend exercises={exercises} rirHref={`${scienceHref}/rir`} />
        {glossary.length > 0 ? (
          <details className="group mt-2 border-b border-border">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted [&::-webkit-details-marker]:hidden">
              Termos deste plano ({glossary.length})
              <GArrow className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
            </summary>
            <dl className="flex flex-col gap-2 pb-3 text-xs">
              {glossary.map((g) => (
                <div key={g.term}>
                  <dt className="inline font-semibold">{g.term}</dt>
                  <dd className="inline text-muted"> — {g.meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          {template.days.map((day, i) => (
            <div key={day.id} className="overflow-hidden border-t-2 border-t-[var(--rule-heavy)] bg-surface">
              <div className="flex items-baseline justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-foreground/30">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-bold">{day.namePt}</h3>
                </div>
                {day.estimatedMinutes ? (
                  <span className="shrink-0 font-mono text-[11px] text-muted">~{day.estimatedMinutes}′</span>
                ) : null}
              </div>
              <ul className="divide-y divide-border">
                {day.exercises.map((ex) => (
                  <li key={ex.id}>
                    <Link
                      href={`${exerciseHref}/${ex.exercise.slug}`}
                      className="group flex gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--ink-3)]"
                    >
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
                        {ex.exercise.media?.[0]?.url ? (
                          <Image
                            src={ex.exercise.media[0].url}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted">
                            <GLoad className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm group-hover:text-accent">{ex.exercise.namePt}</span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted">
                          <span className="font-semibold tabular-nums text-foreground">
                            {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                          </span>
                          {ex.rirTarget != null ? <span>{formatRir(ex.rirTarget)}</span> : null}
                          {ex.warmupSets > 0 ? <span>+{ex.warmupSets} aquec.</span> : null}
                        </div>
                        {ex.notesPt ? <p className="mt-1 text-xs text-muted">{ex.notesPt}</p> : null}
                      </div>
                      <GArrow className="mt-1 size-3.5 shrink-0 self-start text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly progression timeline */}
      {weekly.length > 0 ? (
        <section id="progressao" className="mt-10 scroll-mt-4">
          <SectionHead label="Progressão semana a semana" />
          <div className="mt-4 flex flex-col">
            {weekly.map((w, i) => (
              <div key={w.week} className="flex gap-4">
                {/* rail */}
                <div className="flex flex-col items-center">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-border bg-surface font-mono text-xs font-bold">
                    {w.week}
                  </div>
                  {i < weekly.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                </div>
                <div className="pb-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[2px] bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
                      RIR ~{formatNumber(w.rirTarget)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted">Semana {w.week}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground/90">{w.setsNotePt}</p>
                  {w.notePt ? <p className="mt-0.5 text-xs text-muted">{w.notePt}</p> : null}
                </div>
              </div>
            ))}
          </div>
          {template.restGuidancePt ? (
            <p className="mt-2 rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-sm text-muted">
              <span className="font-semibold text-foreground">Descanso.</span> {template.restGuidancePt}
            </p>
          ) : null}
        </section>
      ) : null}

      <CollapsibleSection title="Descrição" id="descricao">
        <Markdown text={template.descriptionPt} />
      </CollapsibleSection>

      {/* Science */}
      <CollapsibleSection title="Base científica" id="ciencia">
        <Markdown text={template.rationalePt} />
        {template.evidence.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {template.evidence.map((ev) => (
              <a
                key={ev.sourceId}
                href={ev.source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5 text-sm hover:bg-[var(--ink-2)]"
              >
                <span className="min-w-0">
                  <span className="line-clamp-1">{ev.source.title}</span>
                  <span className="text-xs text-muted">
                    {ev.source.journal}, {ev.source.publicationYear}
                  </span>
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-muted" />
              </a>
            ))}
          </div>
        ) : null}
        {template.principles.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {template.principles.map((tp) => (
              <Link
                key={tp.principleId}
                href={`${scienceHref}/${tp.principle.slug}`}
                className="inline-flex min-h-9 items-center rounded-[2px] bg-accent-soft px-3 text-xs font-medium text-accent hover:brightness-95"
              >
                {tp.principle.titlePt}
              </Link>
            ))}
          </div>
        ) : null}
      </CollapsibleSection>

      {stickyActions ? <StickyActionsBar watchId="dossier-actions">{stickyActions}</StickyActionsBar> : null}
    </div>
  );
}

/**
 * "PLANO GD · BLOCO 3 DE 9 · FAÇA ANTES: GD 2", the series rail with this
 * block marked, and the blocks before and after it.
 */
function SeriesPlace({ series }: { series: DossierSeries }) {
  const at = series.blocks.findIndex((b) => b.slug === series.current);
  if (at < 0) return null;
  const block = series.blocks[at];
  const prev = at > 0 ? series.blocks[at - 1] : null;
  const next = at < series.blocks.length - 1 ? series.blocks[at + 1] : null;
  const link = "font-bold text-accent hover:underline";
  return (
    <div className="mt-4 border-t border-border pt-3" data-series-place>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        Plano GD · Bloco {at + 1} de {series.blocks.length}
        {prev ? (
          <>
            {" · "}
            <span className="whitespace-nowrap">
              faça antes:{" "}
              <Link href={prev.href} className={link}>
                {prev.name}
              </Link>
            </span>
          </>
        ) : (
          " · o início do plano"
        )}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
        Semanas {block.fromWeek}–{block.toWeek} de {series.blocks[series.blocks.length - 1].toWeek}
      </p>
      {at === 1 && prev ? (
        <p className="mt-1.5 text-xs text-muted">Já treina com boa técnica? Dá para começar o plano por aqui.</p>
      ) : null}
      <SeriesRail blocks={series.blocks} current={series.current} className="mt-3" />
      {/* Each link stays on one line ("GD Adaptação", "Depois: GD 2"); when both don't
          fit side by side (320 px), the next one moves under the first, still on the right. */}
      <nav aria-label="Blocos do Plano GD" className="mt-3 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        {prev ? (
          <Link href={prev.href} className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap font-semibold hover:text-accent">
            <ArrowLeft className="size-3.5" aria-hidden />
            {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={next.href}
            className="ml-auto inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-right font-semibold hover:text-accent"
          >
            Depois: {next.name}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted">Último bloco</span>
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
  const code = (s: string) => <span className="font-bold text-foreground">{s}</span>;
  return (
    <p className="mt-3 border-l-2 border-l-accent bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
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
          <Link href={rirHref} className="whitespace-nowrap font-bold text-accent hover:underline">
            Entenda o RIR →
          </Link>
        </>
      ) : null}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** A prose section that collapses (default closed), so the day sheets and weekly
 * plan lead the page instead of a multi-thousand-pixel wall. The summary reuses
 * the editorial field-label + a keyline GArrow that rotates when open. */
function CollapsibleSection({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group mt-8 scroll-mt-4 border-t border-border pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{title}</span>
        <GArrow className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function MastheadStat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <div className="flex flex-col items-center px-2">
      <span className={`font-mono font-bold tabular-nums leading-none ${small ? "text-sm" : "text-lg"}`}>{value}</span>
      <span className="mt-1 text-[9px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}
