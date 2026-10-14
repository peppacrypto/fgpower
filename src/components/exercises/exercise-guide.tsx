import { Check, ChevronDown, ExternalLink, X } from "lucide-react";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { SectionHead } from "@/components/ui/section-head";
import { EvidenceLegend, EvidenceLevel } from "@/components/ui/evidence-references";
import type { ExerciseCard as ExerciseCardData, getExerciseBySlug } from "@/lib/data/exercises";
import type { ExerciseContent } from "@/lib/exercises/content";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";

/*
 * The exercise page's body, shared by the public page (/exercises/[slug]) and
 * the app's (/app/exercises/[slug]). Reading order follows what helps execute
 * a set safely: the demonstration (TechniqueFrames, on the page), then the
 * technique in short — the coaching cues and the common mistakes — then every
 * step of "Como executar", always open. The long texts (preparation,
 * breathing, range of motion), the variations and the science sit below in
 * sections that open on a tap.
 */

type ExerciseDetail = NonNullable<Awaited<ReturnType<typeof getExerciseBySlug>>>;

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

/** "Iniciante · Composto · Bilateral": the line under the exercise's name. */
export function exerciseKind(exercise: Pick<ExerciseDetail, "difficulty" | "mechanics" | "laterality">): string {
  return [DIFFICULTY_LABEL[exercise.difficulty], MECHANICS_LABEL[exercise.mechanics], LATERALITY_LABEL[exercise.laterality]]
    .filter(Boolean)
    .join(" · ");
}

/** Muscles, equipment and movement pattern, each a labelled row of calm chips. */
export function ExerciseFacts({ exercise, className }: { exercise: ExerciseDetail; className?: string }) {
  const primary = exercise.muscles.filter((m) => m.role === "PRIMARY").map((m) => m.muscle);
  const secondary = exercise.muscles.filter((m) => m.role === "SECONDARY").map((m) => m.muscle);
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6", className)}>
      <Fact label="Músculos primários">
        {primary.length > 0 ? primary.map((m) => <Chip key={m.id} strong>{m.namePt}</Chip>) : <None />}
      </Fact>
      <Fact label="Equipamento">
        <Chip strong>{exercise.equipment?.namePt ?? "Nenhum"}</Chip>
      </Fact>
      {/* Not every exercise lists secondary muscles or has a pattern classified yet: no row rather than "—". */}
      {secondary.length > 0 ? (
        <Fact label="Músculos secundários" className="col-span-2">
          {secondary.map((m) => (
            <Chip key={m.id}>{m.namePt}</Chip>
          ))}
        </Fact>
      ) : null}
      {exercise.movementPattern ? (
        <Fact label="Padrão de movimento">
          <Chip>{exercise.movementPattern.namePt}</Chip>
        </Fact>
      ) : null}
    </dl>
  );
}

function Fact({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5">{children}</dd>
    </div>
  );
}

function Chip({ strong = false, children }: { strong?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("tag tag--spec px-2.5 py-1 text-[13px]", strong ? "font-semibold" : "text-muted")}>{children}</span>
  );
}

function None() {
  return <span className="text-sm text-muted">—</span>;
}

/**
 * The technique in short, before the long texts: the coaching cues (✓) and
 * the common mistakes (×). Nothing for an exercise without a full guide.
 */
export function ExerciseSynthesis({ content, className }: { content: ExerciseContent | null; className?: string }) {
  const cues = content?.coachingCues ?? [];
  const mistakes = content?.commonMistakes ?? [];
  if (cues.length === 0 && mistakes.length === 0) return null;
  return (
    <div className={cn("card divide-y divide-border", className)}>
      {cues.length > 0 ? (
        <section aria-labelledby="dicas-de-execucao" className="p-4 sm:p-5">
          <h2 id="dicas-de-execucao" className="text-base font-semibold">
            Dicas de execução
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {cues.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
                <Check aria-hidden strokeWidth={2.5} className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {mistakes.length > 0 ? (
        <section aria-labelledby="erros-comuns" className="p-4 sm:p-5">
          <h2 id="erros-comuns" className="text-base font-semibold">
            Erros comuns
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {mistakes.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
                <X aria-hidden strokeWidth={2.5} className="mt-0.5 size-4 shrink-0 text-danger" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Every step of "Como executar" (always open — it is how the set is done),
 * then the sections that open on a tap: preparation, breathing, range of
 * motion, variations and the science. `relationHref` builds a variation's link.
 */
export function ExerciseGuide({
  exercise,
  content,
  instructions,
  relationHref,
  className,
}: {
  exercise: ExerciseDetail;
  content: ExerciseContent | null;
  instructions: string[];
  relationHref: (slug: string) => string;
  className?: string;
}) {
  const regressions = exercise.relationsFrom.filter((r) => r.kind === "REGRESSION");
  const progressions = exercise.relationsFrom.filter((r) => r.kind === "PROGRESSION");
  const alternatives = exercise.relationsFrom.filter((r) => r.kind === "ALTERNATIVE");
  const variations = [
    regressions.length > 0 ? plural(regressions.length, "regressão", "regressões") : null,
    progressions.length > 0 ? plural(progressions.length, "progressão", "progressões") : null,
    alternatives.length > 0 ? plural(alternatives.length, "alternativa", "alternativas") : null,
  ].filter((v) => v !== null);
  const why = content?.whyThisExerciseExists ?? "";
  const evidence = exercise.evidence;
  const hasFolds = Boolean(content?.setup || content?.breathing || content?.rangeOfMotion) || variations.length > 0 || Boolean(why) || evidence.length > 0;

  return (
    <div className={className}>
      {instructions.length > 0 ? (
        <section aria-labelledby="como-executar">
          <SectionHead id="como-executar" label="Como executar" count={plural(instructions.length, "passo", "passos")} />
          <ol className="mt-4 flex flex-col gap-4">
            {instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold tabular-nums text-accent"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[15px] leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {hasFolds ? (
        <div className={cn("card divide-y divide-border px-4 sm:px-5", instructions.length > 0 && "mt-8")}>
          {content?.setup ? (
            <Fold title="Preparação">
              <Prose>{content.setup}</Prose>
            </Fold>
          ) : null}
          {content?.breathing ? (
            <Fold title="Respiração">
              <Prose>{content.breathing}</Prose>
            </Fold>
          ) : null}
          {content?.rangeOfMotion ? (
            <Fold title="Amplitude de movimento">
              <Prose>{content.rangeOfMotion}</Prose>
            </Fold>
          ) : null}
          {variations.length > 0 ? (
            <Fold title="Variações" hint={variations.join(" · ")}>
              <div className="flex flex-col gap-6">
                <RelationRow label="Regressões" items={regressions} href={relationHref} />
                <RelationRow label="Progressões" items={progressions} href={relationHref} />
                <RelationRow label="Alternativas" items={alternatives} href={relationHref} />
              </div>
            </Fold>
          ) : null}
          {why || evidence.length > 0 ? (
            <Fold
              title="Base científica"
              hint={[why ? "Por que este exercício" : null, evidence.length > 0 ? plural(evidence.length, "fonte", "fontes") : null]
                .filter(Boolean)
                .join(" · ")}
            >
              {why ? <Prose>{why}</Prose> : null}
              {evidence.length > 0 ? (
                <ol className={cn("flex flex-col gap-3", why && "mt-4")}>
                  {evidence.map((ev) => (
                    <li key={ev.sourceId} className="rounded-[var(--radius-md)] bg-surface-2 p-3.5 sm:p-4">
                      <p lang="en" className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                        {ev.source.title}
                      </p>
                      <p className="mt-1 text-[13px] text-muted [overflow-wrap:anywhere]">
                        {ev.source.authors} · {ev.source.journal} ·{" "}
                        <span className="tabular-nums">{ev.source.publicationYear}</span>
                      </p>
                      <div className="mt-2">
                        <EvidenceLevel level={ev.source.evidenceLevel} />
                      </div>
                      {ev.notePt ? <p className="mt-2.5 text-sm leading-relaxed">{ev.notePt}</p> : null}
                      <a
                        href={ev.source.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Ver fonte: ${ev.source.title} (abre em nova aba)`}
                        className="-mb-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-accent hover:underline"
                      >
                        Ver fonte <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    </li>
                  ))}
                </ol>
              ) : null}
              {evidence.length > 0 ? <EvidenceLegend className="mt-4" /> : null}
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                A evidência descreve princípios de treino e biomecânica. Ela não implica que este exercício seja
                exclusivamente superior a toda alternativa.
              </p>
            </Fold>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A section that opens on a tap. Its title is a real heading (heading
 * navigation still finds it, closed), with a short hint of what is inside.
 */
function Fold({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <h2 className="text-base font-semibold">{title}</h2>
        <ChevronDown
          aria-hidden
          className="row-span-2 size-5 text-muted transition-transform group-open:rotate-180 group-hover:text-foreground"
        />
        {hint ? <span className="text-[13px] text-muted">{hint}</span> : null}
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="max-w-prose text-[15px] leading-relaxed">{children}</p>;
}

function RelationRow({
  label,
  items,
  href,
}: {
  label: string;
  items: { related: ExerciseCardData }[];
  href: (slug: string) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2.5 text-[13px] font-medium text-muted">{label}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, i) => (
          <ExerciseCard key={i} exercise={item.related} href={href(item.related.slug)} />
        ))}
      </div>
    </div>
  );
}
