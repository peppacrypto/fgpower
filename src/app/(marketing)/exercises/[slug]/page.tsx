import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Dumbbell, ExternalLink } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/require-user";
import { getExerciseBySlug, type ExerciseCard as ExerciseCardData } from "@/lib/data/exercises";
import { parseExerciseContent, parseInstructions } from "@/lib/exercises/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExerciseCard } from "@/components/exercises/exercise-card";

const DIFFICULTY_LABEL: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};
const MECHANICS_LABEL: Record<string, string> = { COMPOUND: "Composto", ISOLATION: "Isolado" };
const LATERALITY_LABEL: Record<string, string> = {
  BILATERAL: "Bilateral",
  UNILATERAL: "Unilateral",
  ALTERNATING: "Alternado",
};
const EVIDENCE_LEVEL_LABEL: Record<string, string> = {
  A: "A — Diretrizes / evidência sistemática forte",
  B: "B — Múltiplos estudos controlados",
  C: "C — Biomecânica ou evidência direta limitada",
  D: "D — Consenso de especialistas",
};

export async function generateMetadata({ params }: PageProps<"/exercises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const exercise = await getExerciseBySlug(slug);
  return exercise ? { title: exercise.namePt } : {};
}

export default async function PublicExerciseDetailPage({ params }: PageProps<"/exercises/[slug]">) {
  const { slug } = await params;
  const session = await getCurrentSession();
  if (session) redirect(`/app/exercises/${slug}`);

  const exercise = await getExerciseBySlug(slug);
  if (!exercise) notFound();

  const content = parseExerciseContent(exercise.contentPt);
  const instructions = parseInstructions(exercise.instructionsPt);
  const primaryMuscles = exercise.muscles.filter((m) => m.role === "PRIMARY").map((m) => m.muscle);
  const secondaryMuscles = exercise.muscles.filter((m) => m.role === "SECONDARY").map((m) => m.muscle);

  const regressions = exercise.relationsFrom.filter((r) => r.kind === "REGRESSION");
  const progressions = exercise.relationsFrom.filter((r) => r.kind === "PROGRESSION");
  const alternatives = exercise.relationsFrom.filter((r) => r.kind === "ALTERNATIVE");

  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex gap-2 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-2">
          {exercise.media.length > 0 ? (
            exercise.media.map((m) => (
              <div key={m.id} className="relative aspect-[3/4] flex-1">
                <Image src={m.url} alt={exercise.namePt} fill className="object-cover" sizes="50vw" priority />
              </div>
            ))
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center text-muted">
              <Dumbbell className="size-10" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-display text-2xl font-semibold">{exercise.namePt}</h1>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted">Músculos primários</dt>
              <dd className="font-medium">{primaryMuscles.map((m) => m.namePt).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Músculos secundários</dt>
              <dd className="font-medium">{secondaryMuscles.map((m) => m.namePt).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Equipamento</dt>
              <dd className="font-medium">{exercise.equipment?.namePt ?? "Nenhum"}</dd>
            </div>
            <div>
              <dt className="text-muted">Padrão de movimento</dt>
              <dd className="font-medium">{exercise.movementPattern?.namePt ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Dificuldade</dt>
              <dd className="font-medium">{DIFFICULTY_LABEL[exercise.difficulty]}</dd>
            </div>
            <div>
              <dt className="text-muted">Tipo</dt>
              <dd className="font-medium">
                {MECHANICS_LABEL[exercise.mechanics]} · {LATERALITY_LABEL[exercise.laterality]}
              </dd>
            </div>
          </dl>

          <div className="mt-auto rounded-[var(--radius-lg)] border border-accent/30 bg-accent-soft p-4">
            <p className="text-sm text-foreground/90">Entre para favoritar e acompanhar seu progresso neste exercício.</p>
            <Button variant="strong" size="sm" className="mt-3" asChild>
              <Link href="/login">
                Continuar com Google
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Section title="Como executar">
        <ol className="flex flex-col gap-3">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                {i + 1}
              </span>
              <span className="pt-0.5 text-foreground/90">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      {content ? (
        <>
          <Section title="Preparação">
            <p className="text-sm text-foreground/90">{content.setup}</p>
          </Section>
          {content.breathing ? (
            <Section title="Respiração">
              <p className="text-sm text-foreground/90">{content.breathing}</p>
            </Section>
          ) : null}
          {content.coachingCues.length > 0 ? (
            <Section title="Dicas de execução">
              <ul className="list-inside list-disc space-y-1.5 text-sm text-foreground/90">
                {content.coachingCues.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Section>
          ) : null}
          {content.commonMistakes.length > 0 ? (
            <Section title="Erros comuns">
              <ul className="list-inside list-disc space-y-1.5 text-sm text-foreground/90">
                {content.commonMistakes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Section>
          ) : null}
          {content.rangeOfMotion ? (
            <Section title="Amplitude de movimento">
              <p className="text-sm text-foreground/90">{content.rangeOfMotion}</p>
            </Section>
          ) : null}
        </>
      ) : null}

      {regressions.length > 0 || progressions.length > 0 || alternatives.length > 0 ? (
        <Section title="Variações">
          <div className="flex flex-col gap-6">
            <RelationRow label="Regressões" items={regressions} />
            <RelationRow label="Progressões" items={progressions} />
            <RelationRow label="Alternativas" items={alternatives} />
          </div>
        </Section>
      ) : null}

      {content?.whyThisExerciseExists || exercise.evidence.length > 0 ? (
        <Section title="Base científica">
          {content?.whyThisExerciseExists ? (
            <p className="mb-4 text-sm text-foreground/90">{content.whyThisExerciseExists}</p>
          ) : null}
          {exercise.evidence.length > 0 ? (
            <div className="flex flex-col gap-3">
              {exercise.evidence.map((ev) => (
                <div key={ev.sourceId} className="rounded-[var(--radius-md)] border border-border p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{ev.source.title}</p>
                      <p className="text-xs text-muted">
                        {ev.source.authors} · {ev.source.journal} · {ev.source.publicationYear}
                      </p>
                    </div>
                    <Badge variant="accent" className="shrink-0" title={EVIDENCE_LEVEL_LABEL[ev.source.evidenceLevel]}>
                      Nível {ev.source.evidenceLevel}
                    </Badge>
                  </div>
                  {ev.notePt ? <p className="mt-2 text-sm text-foreground/90">{ev.notePt}</p> : null}
                  <a
                    href={ev.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    Ver fonte <ExternalLink className="size-3" />
                  </a>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted">
            A evidência descreve princípios de treino e biomecânica. Ela não implica que este exercício seja
            exclusivamente superior a toda alternativa.
          </p>
        </Section>
      ) : null}
      </div>
    </MarketingShell>
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

function RelationRow({ label, items }: { label: string; items: { related: ExerciseCardData }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-muted">{label}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, i) => (
          <ExerciseCard key={i} exercise={item.related} href={`/exercises/${item.related.slug}`} />
        ))}
      </div>
    </div>
  );
}
