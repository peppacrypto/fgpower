import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Play } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getTemplateBySlug, listSeriesTemplates } from "@/lib/data/templates";
import { GD_SERIES, seriesBlocks, seriesPosition } from "@/lib/programming/gd-series";
import { getActiveEnrollment } from "@/lib/data/dashboard";
import { getProfile } from "@/lib/data/profile";
import { getEnrollmentProgress } from "@/lib/data/user-programs";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { startTemplate, startTemplateAndBegin, customizeTemplate } from "@/lib/actions/programs";
import { TemplateDossier } from "@/components/programs/template-dossier";
import { SwitchProgramButton } from "@/components/programs/switch-program-button";
import { LimitationsNote } from "@/components/programs/limitations-note";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { shortDayName } from "@/lib/programming/day-tokens";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

/** A big masthead button that wraps inside itself on a narrow phone instead of spilling out of the panel. */
const WRAPPING_LG = "h-auto min-h-13 w-full whitespace-normal py-3 text-center text-balance max-sm:px-5 sm:w-auto";

export async function generateMetadata({ params }: PageProps<"/app/programs/templates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  return t ? { title: t.namePt } : { title: NOT_FOUND_TITLE };
}

export default async function TemplateDetailPage({ params }: PageProps<"/app/programs/templates/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const inSeries = seriesPosition(slug) !== null;
  const [template, activeEnrollment, profile, seriesTemplates] = await Promise.all([
    getTemplateBySlug(slug),
    getActiveEnrollment(user.id),
    getProfile(user.id),
    inSeries ? listSeriesTemplates(GD_SERIES) : Promise.resolve([]),
  ]);
  if (!template) notFound();
  const series = inSeries
    ? { blocks: seriesBlocks(seriesTemplates, (s) => `/app/programs/templates/${s}`), current: template.slug }
    : null;

  // Already following this template: "Ativar" again would fork a fresh copy
  // and reset the program to week 1 — send the user to their workouts instead.
  const alreadyActive = activeEnrollment?.program.sourceTemplateId === template.id;
  // Where the running program stands, for the switch warning.
  const activeProgress = activeEnrollment ? await getEnrollmentProgress(activeEnrollment) : null;
  const firstDay = template.days.find((d) => d.exercises.length > 0);
  const limitations = profile?.limitations?.trim();

  const customize = (size: "md" | "lg") => (
    <form action={customizeTemplate.bind(null, template.slug)}>
      <SubmitButton size={size} variant="outline" pendingLabel="Abrindo…">
        Personalizar
      </SubmitButton>
    </form>
  );
  // With nothing running, the main button starts training right away. On a
  // phone the day's name wraps to a second line inside the button (it used to
  // spill out of it at 320px); the play icon rides the first line with the verb.
  const startNow = (size: "md" | "lg", dayName?: string) =>
    firstDay ? (
      <InlineActionForm
        action={startTemplateAndBegin.bind(null, template.slug)}
        failText="Não foi possível ativar. Tente de novo."
        className={size === "lg" ? "flex w-full flex-col sm:w-auto" : "flex flex-col"}
        errorClassName="mt-1.5"
      >
        <SubmitButton
          size={size}
          variant="strong"
          className={size === "lg" ? WRAPPING_LG : undefined}
          pendingLabel="Preparando o treino…"
        >
          <span>
            <span className="whitespace-nowrap">
              <Play className="mr-2 inline-block align-[-0.15em]" />
              Ativar e iniciar
            </span>
            {dayName ? ` ${dayName}` : null}
          </span>
        </SubmitButton>
      </InlineActionForm>
    ) : null;
  // With another program running, activating is a switch: both the masthead
  // and the sticky bar say so and ask first (each is its own two-step button).
  const switchButton = activeEnrollment ? (
    <SwitchProgramButton
      action={startTemplate.bind(null, template.slug)}
      label="Ativar programa"
      pendingLabel="Ativando…"
      active={{ name: activeEnrollment.program.name, progress: activeProgress ?? "" }}
    />
  ) : null;

  const actions = alreadyActive ? (
    <Button size="lg" variant="strong" asChild className={WRAPPING_LG}>
      <Link href="/app/today">Programa ativo{"\u00a0"}· ir para Hoje</Link>
    </Button>
  ) : switchButton ? (
    <>
      {switchButton}
      {customize("lg")}
    </>
  ) : (
    <>
      {startNow("lg", firstDay ? shortDayName(firstDay.namePt) : undefined)}
      <SwitchProgramButton
        action={startTemplate.bind(null, template.slug)}
        label="Ativar programa"
        pendingLabel="Ativando…"
        variant={firstDay ? "outline" : "strong"}
        size="md"
      />
      {customize("md")}
    </>
  );
  // The sticky bar (once the masthead buttons scrolled away): the main action + "Personalizar", compact.
  const sticky = alreadyActive ? null : switchButton ? (
    <>
      {switchButton}
      {customize("lg")}
    </>
  ) : (
    <>
      {startNow("md") ?? (
        <SwitchProgramButton
          action={startTemplate.bind(null, template.slug)}
          label="Ativar programa"
          pendingLabel="Ativando…"
          size="md"
        />
      )}
      {customize("md")}
    </>
  );

  return (
    <TemplateDossier
      template={template}
      scienceHref="/app/science"
      exerciseHref="/app/exercises"
      note={
        limitations ? (
          <LimitationsNote
            text={limitations}
            fix={<>Algum exercício deste plano não serve para você? Toque em “Personalizar” para trocá-lo.</>}
          />
        ) : null
      }
      actions={actions}
      stickyActions={sticky}
      series={series}
    />
  );
}
