import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Play } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getTemplateBySlug, listSeriesTemplates, listTemplates, toCatalogItem } from "@/lib/data/templates";
import { EQUIPMENT_FOR_ACCESS } from "@/lib/data/alternatives";
import { GD_SERIES, seriesBlocks, seriesPosition } from "@/lib/programming/gd-series";
import { missingEquipment, joinPt, needLabels } from "@/lib/programming/equipment-needs";
import { similarPrograms } from "@/lib/programming/similar";
import { ADAPT_LABEL, EQUIPMENT_LABEL } from "@/lib/constants/program-labels";
import { getActiveEnrollment } from "@/lib/data/dashboard";
import { getProfile } from "@/lib/data/profile";
import { getEnrollmentProgress, isUntouchedFork } from "@/lib/data/user-programs";
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

export default async function TemplateDetailPage({ params, searchParams }: PageProps<"/app/programs/templates/[slug]">) {
  const { slug } = await params;
  const discarded = (await searchParams).descartado === "1";
  const user = await requireUser();
  const inSeries = seriesPosition(slug) !== null;
  const [template, activeEnrollment, profile, seriesTemplates, catalog] = await Promise.all([
    getTemplateBySlug(slug),
    getActiveEnrollment(user.id),
    getProfile(user.id),
    inSeries ? listSeriesTemplates(GD_SERIES) : Promise.resolve([]),
    listTemplates(),
  ]);
  if (!template) notFound();
  const series = inSeries
    ? { blocks: seriesBlocks(seriesTemplates, (s) => `/app/programs/templates/${s}`), current: template.slug }
    : null;

  // Already following this template: "Ativar" again would fork a fresh copy
  // and reset the program to week 1 — send the user to their workouts instead,
  // and "Personalizar" becomes "Ajustar meu …": the running program, edited in place.
  const alreadyActive = activeEnrollment?.program.sourceTemplateId === template.id;
  // Where the running program stands, for the switch warning.
  const activeProgress = activeEnrollment ? await getEnrollmentProgress(activeEnrollment) : null;
  const firstDay = template.days.find((d) => d.exercises.length > 0);
  const limitations = profile?.limitations?.trim();
  // The copy of this template the user last worked on — edited, adapted or duplicated.
  // A plain copy never saved is skipped: Personalizar reopens that one by itself, and
  // being the newest it would otherwise hide the copy that holds their changes.
  const drafts = alreadyActive
    ? []
    : await prisma.userProgram.findMany({
        where: { userId: user.id, sourceTemplateId: template.id, status: "DRAFT" },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
  const editedDraft = drafts.find((d) => !(d.name === template.namePt && isUntouchedFork(d))) ?? null;

  // Equipment: what the exercises use that the user's access lacks ("Adaptar para halteres").
  const access = profile?.equipmentAccess ?? "FULL_GYM";
  const equipmentIds = template.days.flatMap((d) => d.exercises.map((ex) => ex.exercise.equipmentId));
  const missing = missingEquipment(equipmentIds, EQUIPMENT_FOR_ACCESS[access] ?? null);

  // "Parecidos": same goal family, nearby level.
  const catalogItems = catalog.map(toCatalogItem);
  const current = catalogItems.find((t) => t.slug === template.slug);
  const similar = current
    ? similarPrograms(current, catalogItems).map((t) => ({ ...t, href: `/app/programs/templates/${t.slug}` }))
    : [];

  const customize = (size: "md" | "lg") => (
    <form action={customizeTemplate.bind(null, template.slug)}>
      <SubmitButton size={size} variant="outline" pendingLabel="Abrindo…">
        Personalizar
      </SubmitButton>
    </form>
  );
  // What "Personalizar" does, said once under the masthead's buttons.
  const customizeHelp = (
    <p className="basis-full text-xs text-muted" data-testid="customize-help">
      Personalizar cria uma cópia sua; o original não muda.
      {editedDraft ? (
        <>
          {" "}
          Você já tem uma:{" "}
          <Link href={`/app/programs/${editedDraft.id}/edit`} className="font-semibold text-accent hover:underline">
            continuar “{editedDraft.name}”
          </Link>
          .
        </>
      ) : null}
    </p>
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
    <>
      <Button size="lg" variant="strong" asChild className={WRAPPING_LG}>
        <Link href="/app/today">Programa ativo{" "}· ir para Hoje</Link>
      </Button>
      <Button
        size="md"
        variant="outline"
        asChild
        className="h-auto min-h-11 max-w-full whitespace-normal py-2.5 text-center text-balance"
      >
        <Link href={`/app/programs/${activeEnrollment!.programId}/edit`}>Ajustar meu {activeEnrollment!.program.name}</Link>
      </Button>
    </>
  ) : switchButton ? (
    <>
      {switchButton}
      {customize("lg")}
      {customizeHelp}
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
      {customizeHelp}
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

  const adapt =
    missing.length > 0 && ADAPT_LABEL[access] ? (
      <div
        className="mt-4 border-l-2 border-l-warning bg-warning-soft px-4 py-3"
        data-testid="adapt-panel"
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-warning">
          Você marcou: {EQUIPMENT_LABEL[access]}
        </p>
        <p className="mt-1 text-sm text-foreground/90">
          Este programa usa <span className="font-semibold">{joinPt(needLabels(missing))}</span>. Dá para trocar esses
          exercícios por outros com o seu equipamento — você confere cada troca antes de salvar.
        </p>
        <Button asChild variant="strong" className="mt-3">
          <Link href={`/app/programs/templates/${template.slug}/adapt`}>{ADAPT_LABEL[access]}</Link>
        </Button>
      </div>
    ) : null;

  return (
    <>
      {discarded ? (
        <p role="status" className="mx-auto mt-6 max-w-3xl px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] sm:px-6">
          <span className="border-l-2 border-l-success bg-surface-2 px-3 py-2">Rascunho descartado</span>
        </p>
      ) : null}
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
        adapt={adapt}
        similar={similar}
        actions={actions}
        stickyActions={sticky}
        series={series}
      />
    </>
  );
}
