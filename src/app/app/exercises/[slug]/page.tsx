import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { GArrow, GProgress } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import {
  getExerciseBySlug,
  getProgramUsesBySlug,
  isFavoriteSlug,
  type ExerciseCard as ExerciseCardData,
  type ProgramUse,
} from "@/lib/data/exercises";
import { parseExerciseContent, parseInstructions } from "@/lib/exercises/content";
import { isTimedHold } from "@/lib/training/set-plan";
import { Badge } from "@/components/ui/badge";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { TechniqueFrames } from "@/components/exercises/technique-frames";
import { FavoriteButton } from "./favorite-button";
import { getCurrentSession } from "@/lib/auth/require-user";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

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

export async function generateMetadata({ params }: PageProps<"/app/exercises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const exercise = await getExerciseBySlug(slug);
  if (!exercise) return { title: NOT_FOUND_TITLE };
  return { title: exercise.namePt };
}

/** "Ver página completa" from the workout's technique sheet: `/app/workout/<id>?ex=<log>`, nothing else. */
const WORKOUT_RETURN = /^\/app\/workout\/[\w-]+(\?ex=[\w-]+)?$/;

export default async function ExerciseDetailPage({ params, searchParams }: PageProps<"/app/exercises/[slug]">) {
  const { slug } = await params;
  const from = (await searchParams).from;
  // Back to the same exercise of the open workout (W-025), not the library.
  const backToWorkout = typeof from === "string" && WORKOUT_RETURN.test(from) ? from : null;
  // The user's side (favorite, where it sits in their program) keys on the
  // slug, so it loads alongside the exercise instead of after it.
  const mine = getCurrentSession().then(async (session) => {
    if (!session) return null;
    const [favorited, uses] = await Promise.all([
      isFavoriteSlug(session.user.id, slug),
      getProgramUsesBySlug(session.user.id, slug),
    ]);
    return { favorited, uses };
  });
  const [exercise, user] = await Promise.all([getExerciseBySlug(slug), mine]);
  if (!exercise) notFound();

  const content = parseExerciseContent(exercise.contentPt);
  const instructions = parseInstructions(exercise.instructionsPt);
  const primaryMuscles = exercise.muscles.filter((m) => m.role === "PRIMARY").map((m) => m.muscle);
  const secondaryMuscles = exercise.muscles.filter((m) => m.role === "SECONDARY").map((m) => m.muscle);
  const uses = user?.uses ?? [];

  const regressions = exercise.relationsFrom.filter((r) => r.kind === "REGRESSION");
  const progressions = exercise.relationsFrom.filter((r) => r.kind === "PROGRESSION");
  const alternatives = exercise.relationsFrom.filter((r) => r.kind === "ALTERNATIVE");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={backToWorkout ?? "/app/exercises"}
        className="-mt-2 -ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        {backToWorkout ? "Voltar ao treino" : "Exercícios"}
      </Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <TechniqueFrames name={exercise.namePt} media={exercise.media} />

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-display min-w-0 break-words text-2xl font-extrabold">{exercise.namePt}</h1>
            {user ? (
              <div className="flex shrink-0 items-center gap-2">
                <FavoriteButton exerciseId={exercise.id} initialFavorited={user.favorited} />
              </div>
            ) : null}
          </div>

          {uses.length > 0 ? <InYourProgram uses={uses} slug={exercise.slug} /> : null}

          {/* The way into this exercise's charts, records and sessions. */}
          <Button variant="outline" size="sm" asChild className="min-h-11 self-start">
            <Link href={`/app/exercises/${exercise.slug}/history`}>
              <GProgress className="size-4" />
              Meu histórico
            </Link>
          </Button>

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
            {/* Not every exercise has a pattern classified yet: no row rather than "—". */}
            {exercise.movementPattern ? (
              <div>
                <dt className="text-muted">Padrão de movimento</dt>
                <dd className="font-medium">{exercise.movementPattern.namePt}</dd>
              </div>
            ) : null}
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
        </div>
      </div>

      <Section title="Como executar">
        <ol className="flex flex-col gap-3">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-[2px] bg-accent-soft text-xs font-bold text-accent">
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
                <div key={ev.sourceId} className="reg-frame p-3.5">
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
          {exercise.evidence.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-0.5 text-[11px] text-muted">
              {Object.entries(EVIDENCE_LEVEL_LABEL).map(([level, label]) => (
                <li key={level}>{label}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs text-muted">
            A evidência descreve princípios de treino e biomecânica. Ela não implica que este exercício seja
            exclusivamente superior a toda alternativa.
          </p>
        </Section>
      ) : null}
    </div>
  );
}

/**
 * "No seu programa": the days of the running program that do this exercise,
 * with their prescription — the page answers "how much do I do of it?".
 */
function InYourProgram({ uses, slug }: { uses: ProgramUse[]; slug: string }) {
  return (
    <div className="border-l-2 border-l-accent bg-surface-2 px-3.5 py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
        No seu programa · <span className="text-foreground">{uses[0].programName}</span>
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 text-sm">
        {uses.map((u, i) => {
          const timed = isTimedHold({ slug, notes: u.notes });
          const reps = u.repMin === u.repMax ? `${u.repMin}` : `${u.repMin}-${u.repMax}`;
          return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{u.dayName}</span>
              <span className="font-mono text-xs tabular-nums text-muted">
                {u.sets}×{reps}
                {timed ? " s" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/app/programs/${uses[0].programId}`}
        className="-mb-2 inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
      >
        Ver programa
        <GArrow className="size-3" />
      </Link>
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

function RelationRow({ label, items }: { label: string; items: { related: ExerciseCardData }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-muted">{label}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, i) => (
          <ExerciseCard key={i} exercise={item.related} href={`/app/exercises/${item.related.slug}`} />
        ))}
      </div>
    </div>
  );
}
