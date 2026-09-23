import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { Markdown } from "@/components/markdown";
import { SectionHead } from "@/components/ui/section-head";
import { GOAL_LABEL, EXPERIENCE_LABEL, STYLE_LABEL, GOAL_HUE } from "@/lib/constants/program-labels";

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
      exercise: { namePt: string; slug: string };
    }[];
  }[];
  evidence: { sourceId: string; source: { url: string; title: string; journal: string; publicationYear: number } }[];
  principles: { principleId: string; principle: { slug: string; titlePt: string } }[];
}

/** A workout template rendered as a "training dossier" — masthead, jump nav, day
 * sheets with indexed exercises, a weekly progression timeline, and cited
 * evidence. Long prose sections (description, science) are collapsible so the
 * actual plan sits near the top. `actions` is the masthead CTA (start/customize
 * in-app, or login on the public page); `stickyActions`, when given, also pins a
 * start CTA to the bottom of the (very tall) page. `scienceHref` prefixes
 * principle links. */
export function TemplateDossier({
  template,
  actions,
  stickyActions,
  scienceHref,
}: {
  template: DossierTemplate;
  actions: React.ReactNode;
  stickyActions?: React.ReactNode;
  scienceHref: string;
}) {
  const hue = GOAL_HUE[template.goal] ?? GOAL_HUE.GENERAL_FITNESS;
  const weekly = Array.isArray(template.weeklyGuidance)
    ? (template.weeklyGuidance as Array<{ week: number; rirTarget: number; setsNotePt: string; notePt?: string }>)
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Masthead */}
      <div className="relative overflow-hidden panel-raised p-6 sm:p-8">
        <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: hue.spine }} aria-hidden />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {STYLE_LABEL[template.trainingStyle] ?? "Protocolo"}
          </span>
          <span className="tag tag--field" style={{ color: hue.fg }}>
            {GOAL_LABEL[template.goal] ?? template.goal}
          </span>
          <span className="tag tag--spec">{EXPERIENCE_LABEL[template.experienceLevel] ?? template.experienceLevel}</span>
          {template.isFlagship ? <span className="tag tag--mark text-[9px]">Destaque</span> : null}
        </div>
        <h1 className="text-display mt-2 text-3xl font-extrabold sm:text-4xl">{template.namePt}</h1>
        <p className="mt-2 text-muted">{template.taglinePt}</p>

        <div className="mt-6 grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-center">
          <MastheadStat value={`${template.daysPerWeek}×`} label="/ semana" />
          <MastheadStat value={String(template.durationWeeks)} label="semanas" />
          <MastheadStat value={`${template.sessionMinutes}′`} label="por sessão" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
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

      {/* Day sheets — the actual plan, kept expanded and high on the page */}
      <section id="estrutura" className="mt-10 scroll-mt-4">
        <SectionHead label="Estrutura semanal" count={`${template.days.length} dias`} />
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
                  <li key={ex.id} className="px-4 py-2.5">
                    <span className="block text-sm">{ex.exercise.namePt}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted">
                      <span className="font-semibold tabular-nums text-foreground">
                        {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                      </span>
                      {ex.rirTarget != null ? <span>RIR {ex.rirTarget}</span> : null}
                      {ex.warmupSets > 0 ? <span>+{ex.warmupSets} aq</span> : null}
                    </div>
                    {ex.notesPt ? <p className="mt-1 text-xs text-muted">{ex.notesPt}</p> : null}
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
                      RIR ~{w.rirTarget}
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

      {stickyActions ? (
        <div className="sticky bottom-16 z-30 mt-10 panel-raised p-3 sm:bottom-4">
          <div className="flex flex-wrap gap-2">{stickyActions}</div>
        </div>
      ) : null}
    </div>
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
