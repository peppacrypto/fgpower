import Link from "next/link";
import { Play } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { resumeProgram } from "@/lib/actions/programs";
import type { SeriesContinuation } from "@/lib/data/program-lifecycle";
import { cn } from "@/lib/utils/cn";

/**
 * "DE ONDE VOCÊ PAROU": a program stopped mid-block (archived, or ended by a
 * switch) with nothing running since — "Retomar da semana N" puts it back
 * with its workouts, week and next day (resumeProgram). Leads Today's
 * no-program state and the program library while nothing runs, ahead of a
 * fresh start (program-lifecycle getSeriesContinuation).
 */
export function ResumeProgramPanel({
  resume,
  showLibraryLink = false,
  className,
}: {
  resume: NonNullable<SeriesContinuation["resume"]>;
  /** A way to the other programs (Today, where this panel stands alone). */
  showLibraryLink?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="resume-program-title"
      data-testid="resume-program"
      className={cn("relative overflow-hidden panel-raised", className)}
    >
      <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
      <div className="p-6 sm:p-8">
        <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
          De onde você parou
        </span>
        <h2 id="resume-program-title" className="text-display mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
          {resume.programName}
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Seus treinos e a semana continuam de onde pararam —{" "}
          <span className="whitespace-nowrap">
            semana {resume.week}
            {resume.weeks ? ` de ${resume.weeks}` : ""}.
          </span>
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
          <InlineActionForm
            action={resumeProgram.bind(null, resume.programId)}
            failText="Não foi possível retomar. Tente de novo."
            className="flex flex-col"
            errorClassName="mt-1.5"
          >
            <SubmitButton size="lg" variant="strong" className="w-full sm:w-auto" pendingLabel="Retomando…">
              <Play className="size-4" />
              Retomar da semana {resume.week}
            </SubmitButton>
          </InlineActionForm>
          <div className="flex flex-wrap gap-x-5">
            <Link
              href={`/app/programs/${resume.programId}`}
              className="inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Ver programa
              <GArrow className="size-3" />
            </Link>
            {showLibraryLink ? (
              <Link
                href="/app/programs"
                className="inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
              >
                Outros programas
                <GArrow className="size-3" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
