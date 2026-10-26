import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getTemplateBySlug } from "@/lib/data/templates";
import { getProfile } from "@/lib/data/profile";
import {
  EQUIPMENT_FOR_ACCESS,
  adaptRowKey,
  assignStandIns,
  getAlternatives,
  mainGearFirst,
  needsStandIn,
  rankStandIns,
  type AlternativeExercise,
} from "@/lib/data/alternatives";
import { blockingGear } from "@/lib/exercises/gear";
import { GYM_ADAPT_LABEL, missingGearFlag } from "@/lib/programming/equipment-needs";
import { ADAPT_LABEL, EQUIPMENT_LABEL } from "@/lib/constants/program-labels";
import { adaptTemplate } from "@/lib/actions/programs";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { AdaptSaveBar, AdaptSwapChoice, AdaptSwapCounts, DaySwapCount } from "@/components/programs/adapt-swap-choice";
import { plural } from "@/lib/utils/format";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

export async function generateMetadata({ params }: PageProps<"/app/programs/templates/[slug]/adapt">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  return t ? { title: `Adaptar ${t.namePt}` } : { title: NOT_FOUND_TITLE };
}

/** How many stand-ins each exercise offers in its "Trocar por" list. */
const OPTIONS = 5;

/**
 * "Adaptar para halteres" / "Adaptar à sua academia": the review before a
 * program that needs gear the user doesn't have becomes theirs. Every exercise
 * out of their reach — equipment their access level doesn't cover, or an
 * apparatus their gym doesn't have (Settings → Minha academia; alternatives
 * needsStandIn) — is paired with a stand-in (lib/data/alternatives: a curated
 * alternative first, else the same muscle and movement with what they have;
 * their main gear — the dumbbells — before the rest), never the same one twice
 * in a day; each can be changed or kept, and the counts follow. Nothing is
 * saved until "Salvar" — then a copy with those swaps opens in the builder,
 * and the original template never changes. A row's field is named by its day,
 * place and exercise (adaptRowKey), which a reseed keeps; a save naming a row
 * the template no longer has comes back here (?mudou=1) and says why.
 */
export default async function AdaptTemplatePage({ params, searchParams }: PageProps<"/app/programs/templates/[slug]/adapt">) {
  const { slug } = await params;
  const changed = (await searchParams).mudou === "1";
  const user = await requireUser();
  const [template, profile] = await Promise.all([getTemplateBySlug(slug), getProfile(user.id)]);
  if (!template) notFound();
  const access = profile?.equipmentAccess ?? "FULL_GYM";
  const missingGear = profile?.missingGear ?? [];
  const templateHref = `/app/programs/templates/${template.slug}`;
  // At home, by the access level ("Adaptar para halteres"); in a gym, by the
  // apparatus it lacks. A full gym with everything has nothing to adapt.
  const allowed = ADAPT_LABEL[access] ? (EQUIPMENT_FOR_ACCESS[access] ?? null) : null;
  const byAccess = allowed !== null;
  const gym = { allowed, missingGear };
  const exercises = template.days.flatMap((d) => d.exercises);
  if (!byAccess && !exercises.some((ex) => blockingGear(ex.exercise, missingGear).length > 0)) redirect(templateHref);
  const label = byAccess ? ADAPT_LABEL[access] : GYM_ADAPT_LABEL;
  const withWhatYouHave = byAccess ? "com o seu equipamento" : "com o que a sua academia tem";

  // Stand-ins per exercise (once each, however many days use it).
  const needing = [...new Set(exercises.filter((ex) => needsStandIn(ex.exercise, gym)).map((ex) => ex.exerciseId))];
  const alternatives = new Map<string, AlternativeExercise[]>(
    await Promise.all(
      needing.map(
        async (id) => [id, await getAlternatives(id, { equipmentAccess: access, missingGear, limit: OPTIONS + 3 })] as const,
      ),
    ),
  );

  const days = template.days.map((day) => {
    const assigned = assignStandIns(
      day.exercises.map((ex) => ({
        ex,
        exerciseId: ex.exerciseId,
        usableNow: !needsStandIn(ex.exercise, gym),
        difficulty: ex.exercise.difficulty,
        candidates: rankStandIns(mainGearFirst(alternatives.get(ex.exerciseId) ?? [], access), ex.exercise.difficulty),
      })),
      OPTIONS,
    );
    const rows = assigned.map((a) =>
      a.kind === "keep"
        ? ({ kind: "keep" as const, ex: a.ex })
        : ({ kind: "swap" as const, ex: a.ex, pick: a.pick, options: a.options, reps: a.reps, field: `swap:${adaptRowKey(day.dayIndex, a.ex)}` }),
    );
    return { day, rows };
  });
  const swaps = days.flatMap((d) => d.rows).filter((r) => r.kind === "swap");
  const withStandIn = swaps.filter((r) => r.pick).map((r) => r.field);
  const daysTouched = days.filter((d) => d.rows.some((r) => r.kind === "swap")).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6 pt-3 sm:px-6 sm:py-8">
      <Link
        href={templateHref}
        className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {template.namePt}
      </Link>

      <p className="eyebrow mt-3">{byAccess ? EQUIPMENT_LABEL[access] : "Sua academia"} · revise antes de salvar</p>
      <h1 className="text-display mt-0.5 text-[1.75rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[2rem]">
        {label}: {template.namePt}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        {swaps.length === 0
          ? "Todos os exercícios deste programa já cabem no seu equipamento."
          : `${plural(swaps.length, "exercício pede", "exercícios pedem")} o que você não tem, em ${plural(daysTouched, "dia", "dias")}. Sugerimos uma troca para ${withStandIn.length < swaps.length ? "os que têm substituto" : "cada um"} — mesmo músculo e movimento, ${withWhatYouHave}. Séries e descanso seguem o plano; ajustamos as repetições quando o substituto é mais difícil ou mais fácil.`}
      </p>
      <p className="mt-1.5 text-[13px] text-muted">Salvar cria uma cópia sua; o original não muda.</p>
      {changed ? (
        <p role="status" className="mt-4 rounded-[var(--radius-md)] bg-warning-soft px-4 py-3 text-sm">
          Este programa foi atualizado enquanto você revisava. Confira as trocas abaixo e salve de novo.
        </p>
      ) : null}

      <InlineActionForm action={adaptTemplate.bind(null, template.slug)} failText="Não foi possível salvar. Tente de novo.">
        <AdaptSwapCounts initial={withStandIn}>
          <div className="mt-6 flex flex-col gap-4">
            {days.map(({ day, rows }) => {
              const kept = rows.filter((r) => r.kind === "keep");
              const swapped = rows.filter((r) => r.kind === "swap");
              return (
                <section key={day.id} aria-labelledby={`adapt-day-${day.id}`} className="card overflow-hidden">
                  <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                    <h2 id={`adapt-day-${day.id}`} className="min-w-0 text-base font-semibold leading-snug wrap-break-word">
                      {day.namePt}
                    </h2>
                    <span className="shrink-0 text-[13px] tabular-nums text-muted">
                      <DaySwapCount names={swapped.flatMap((r) => (r.kind === "swap" && r.pick ? [r.field] : []))} />
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {swapped.map((r) =>
                      r.kind === "swap" ? (
                        <li key={r.ex.id} className="px-4 py-3.5 sm:px-5" data-testid="adapt-swap">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="text-muted line-through decoration-1">{r.ex.exercise.namePt}</span>
                            <span className="text-[13px] tabular-nums text-muted">
                              {/* What keeps it out of reach: the apparatus the gym lacks, else its equipment. */}
                              {missingGearFlag(blockingGear(r.ex.exercise, missingGear)) ?? r.ex.exercise.equipment?.namePt} ·{" "}
                              {r.ex.sets}×{r.ex.repMin === r.ex.repMax ? r.ex.repMin : `${r.ex.repMin}-${r.ex.repMax}`}
                            </span>
                          </p>
                          {r.kind === "swap" && r.reps?.shift ? (
                            <p className="mt-1 text-[13px] leading-snug text-muted">
                              {r.reps.shift === "harder"
                                ? `Variação mais difícil — sugerimos ${r.ex.sets}×${r.reps.repMin} rep${r.reps.repMin > 1 ? "s" : ""}, parando 1–2 antes da falha.`
                                : `Variação mais fácil — dá para subir para ${r.ex.sets}×${r.reps.repMax} reps.`}
                            </p>
                          ) : null}
                          {r.pick ? (
                            <AdaptSwapChoice
                              name={r.field}
                              original={{ namePt: r.ex.exercise.namePt, equipmentNamePt: r.ex.exercise.equipment?.namePt ?? null }}
                              options={r.options}
                              defaultId={r.pick.id}
                            />
                          ) : (
                            <p className="mt-1.5 text-[13px] leading-snug text-warning">
                              Sem substituto {byAccess ? "com o seu equipamento" : "que a sua academia tenha"} — fica o original. Dá para trocar
                              depois, no editor.
                              <input type="hidden" name={r.field} value="keep" />
                            </p>
                          )}
                        </li>
                      ) : null,
                    )}
                    {kept.length > 0 ? (
                      <li className="px-4 py-3 text-[13px] leading-snug text-muted sm:px-5">
                        <span className="font-semibold text-foreground">
                          {swapped.length > 0 ? `Mantidos (${kept.length})` : "Todos mantidos"}
                        </span>{" "}
                        {kept.map((r) => r.ex.exercise.namePt).join(" · ")}
                      </li>
                    ) : null}
                  </ul>
                </section>
              );
            })}
          </div>

          <AdaptSaveBar cancelHref={templateHref} />
        </AdaptSwapCounts>
      </InlineActionForm>
    </div>
  );
}
