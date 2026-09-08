import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getTemplateBySlug } from "@/lib/data/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startTemplate, customizeTemplate } from "@/lib/actions/programs";
import { Markdown } from "@/components/markdown";

const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
};
const PROGRESSION_LABEL: Record<string, string> = {
  DOUBLE: "Progressão dupla",
  LINEAR_LOAD: "Progressão linear de carga",
  REPETITION: "Progressão de repetições",
  RIR_BASED: "Progressão baseada em RIR",
  MANUAL: "Manual",
};

export async function generateMetadata({ params }: PageProps<"/app/programs/templates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  return t ? { title: t.namePt } : {};
}

export default async function TemplateDetailPage({ params }: PageProps<"/app/programs/templates/[slug]">) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      {template.isFlagship ? (
        <Badge variant="accent" className="mb-3">
          Programa em destaque
        </Badge>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight">{template.namePt}</h1>
      <p className="mt-2 text-muted">{template.taglinePt}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge>{GOAL_LABEL[template.goal] ?? template.goal}</Badge>
        <Badge>{template.daysPerWeek}x/semana</Badge>
        <Badge>{template.durationWeeks} semanas</Badge>
        <Badge>~{template.sessionMinutes} min/sessão</Badge>
        <Badge>{PROGRESSION_LABEL[template.progressionStrategy]}</Badge>
      </div>

      <div className="mt-6 flex gap-2">
        <form action={startTemplate.bind(null, template.slug)}>
          <Button type="submit" size="lg">
            Iniciar programa
          </Button>
        </form>
        <form action={customizeTemplate.bind(null, template.slug)}>
          <Button type="submit" size="lg" variant="outline">
            Personalizar
          </Button>
        </form>
      </div>

      <Section title="Para quem é">
        <p className="text-sm text-foreground/90">{template.audiencePt}</p>
      </Section>

      <Section title="Descrição">
        <Markdown text={template.descriptionPt} />
      </Section>

      <Section title="Estrutura semanal">
        <div className="flex flex-col gap-3">
          {template.days.map((day) => (
            <div key={day.id} className="rounded-[var(--radius-md)] border border-border p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{day.namePt}</h3>
                {day.estimatedMinutes ? <span className="text-xs text-muted">~{day.estimatedMinutes} min</span> : null}
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                {day.exercises.map((ex) => (
                  <li key={ex.id} className="flex justify-between">
                    <span>{ex.exercise.namePt}</span>
                    <span className="font-mono tabular-nums">
                      {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Progressão e volume">
        {Array.isArray(template.weeklyGuidance) && template.weeklyGuidance.length > 0 ? (
          <div className="flex flex-col gap-2">
            {(template.weeklyGuidance as Array<{ week: number; rirTarget: number; setsNotePt: string; notePt: string }>).map(
              (w) => (
                <div key={w.week} className="flex gap-3 rounded-[var(--radius-sm)] bg-surface-2 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold">Semana {w.week}</span>
                  <span className="text-muted">
                    RIR ~{w.rirTarget} · {w.setsNotePt} {w.notePt}
                  </span>
                </div>
              ),
            )}
          </div>
        ) : null}
        {template.restGuidancePt ? (
          <p className="mt-3 text-sm text-muted">Descanso: {template.restGuidancePt}</p>
        ) : null}
      </Section>

      <Section title="Base científica">
        <Markdown text={template.rationalePt} />
        {template.evidence.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {template.evidence.map((ev) => (
              <a
                key={ev.sourceId}
                href={ev.source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border px-3.5 py-2.5 text-sm hover:border-accent/50"
              >
                <span>
                  {ev.source.title} <span className="text-muted">· {ev.source.journal}, {ev.source.publicationYear}</span>
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-muted" />
              </a>
            ))}
          </div>
        ) : null}
        {template.principles.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {template.principles.map((tp) => (
              <Link key={tp.principleId} href={`/app/science/${tp.principle.slug}`}>
                <Badge variant="accent">{tp.principle.titlePt}</Badge>
              </Link>
            ))}
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}
