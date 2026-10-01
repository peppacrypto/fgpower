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
  getAlternatives,
  mainGearFirst,
  type AlternativeExercise,
} from "@/lib/data/alternatives";
import { ADAPT_LABEL, EQUIPMENT_LABEL } from "@/lib/constants/program-labels";
import { adaptTemplate } from "@/lib/actions/programs";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { AdaptSaveLabel, AdaptSwapChoice, AdaptSwapCounts, DaySwapCount } from "@/components/programs/adapt-swap-choice";
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
 * "Adaptar para halteres": the review before a program that needs gear the
 * user doesn't have becomes theirs. Every exercise their equipment can't do
 * is paired with a stand-in (lib/data/alternatives: a curated alternative
 * first, else the same muscle and movement with their equipment; their main
 * gear — the dumbbells — before the rest), never the same one twice in a day;
 * each can be changed or kept, and the counts follow. Nothing is saved until
 * "Salvar" — then a copy with those swaps opens in the builder, and the
 * original template never changes. A row's field is named by its day, place
 * and exercise (adaptRowKey), which a reseed keeps; a save naming a row the
 * template no longer has comes back here (?mudou=1) and says why.
 */
export default async function AdaptTemplatePage({ params, searchParams }: PageProps<"/app/programs/templates/[slug]/adapt">) {
  const { slug } = await params;
  const changed = (await searchParams).mudou === "1";
  const user = await requireUser();
  const [template, profile] = await Promise.all([getTemplateBySlug(slug), getProfile(user.id)]);
  if (!template) notFound();
  const access = profile?.equipmentAccess ?? "FULL_GYM";
  const allowed = EQUIPMENT_FOR_ACCESS[access] ?? null;
  const templateHref = `/app/programs/templates/${template.slug}`;
  if (allowed === null || !ADAPT_LABEL[access]) redirect(templateHref);
  const usable = (equipmentId: string | null) => equipmentId !== null && allowed.includes(equipmentId);

  // Stand-ins per exercise (once each, however many days use it).
  const needing = [
    ...new Set(template.days.flatMap((d) => d.exercises.filter((ex) => !usable(ex.exercise.equipmentId)).map((ex) => ex.exerciseId))),
  ];
  const alternatives = new Map<string, AlternativeExercise[]>(
    await Promise.all(
      needing.map(async (id) => [id, await getAlternatives(id, { equipmentAccess: access, limit: OPTIONS + 3 })] as const),
    ),
  );

  const days = template.days.map((day) => {
    // A stand-in already in the day (kept or picked) isn't picked again for it.
    const used = new Set(day.exercises.filter((ex) => usable(ex.exercise.equipmentId)).map((ex) => ex.exerciseId));
    const rows = day.exercises.map((ex) => {
      if (usable(ex.exercise.equipmentId)) return { kind: "keep" as const, ex };
      const all = mainGearFirst(alternatives.get(ex.exerciseId) ?? [], access);
      const pick = all.find((a) => !used.has(a.id)) ?? all[0] ?? null;
      if (pick) used.add(pick.id);
      const options = pick ? [pick, ...all.filter((a) => a.id !== pick.id)].slice(0, OPTIONS) : [];
      return { kind: "swap" as const, ex, pick, options, field: `swap:${adaptRowKey(day.dayIndex, ex)}` };
    });
    return { day, rows };
  });
  const swaps = days.flatMap((d) => d.rows).filter((r) => r.kind === "swap");
  const withStandIn = swaps.filter((r) => r.pick).map((r) => r.field);
  const daysTouched = days.filter((d) => d.rows.some((r) => r.kind === "swap")).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6 pt-3 sm:px-6 sm:py-8">
      <Link
        href={templateHref}
        className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {template.namePt}
      </Link>

      <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        {EQUIPMENT_LABEL[access]} · revise antes de salvar
      </p>
      <h1 className="text-display mt-1 text-2xl font-extrabold sm:text-3xl">
        {ADAPT_LABEL[access]}: {template.namePt}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {swaps.length === 0
          ? "Todos os exercícios deste programa já cabem no seu equipamento."
          : `${plural(swaps.length, "exercício pede", "exercícios pedem")} o que você não tem, em ${plural(daysTouched, "dia", "dias")}. Sugerimos uma troca para ${withStandIn.length < swaps.length ? "os que têm substituto" : "cada um"} — mesmo músculo e movimento, com o seu equipamento. Séries, repetições e descanso continuam os do plano.`}
      </p>
      <p className="mt-1 text-xs text-muted">Salvar cria uma cópia sua; o original não muda.</p>
      {changed ? (
        <p role="status" className="mt-4 border-l-2 border-l-warning bg-warning-soft px-3.5 py-3 text-sm">
          Este programa foi atualizado enquanto você revisava. Confira as trocas abaixo e salve de novo.
        </p>
      ) : null}

      <InlineActionForm action={adaptTemplate.bind(null, template.slug)} failText="Não foi possível salvar. Tente de novo.">
        <AdaptSwapCounts initial={withStandIn}>
          <div className="mt-6 flex flex-col gap-4">
            {days.map(({ day, rows }, i) => {
              const kept = rows.filter((r) => r.kind === "keep");
              const swapped = rows.filter((r) => r.kind === "swap");
              return (
                <section key={day.id} aria-labelledby={`adapt-day-${day.id}`} className="border-t-2 border-t-[var(--rule-heavy)] bg-surface">
                  <div className="flex items-baseline justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-3">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="font-mono text-sm font-bold text-muted">{String(i + 1).padStart(2, "0")}</span>
                      <h2 id={`adapt-day-${day.id}`} className="font-bold">
                        {day.namePt}
                      </h2>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                      <DaySwapCount names={swapped.flatMap((r) => (r.kind === "swap" && r.pick ? [r.field] : []))} />
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {swapped.map((r) =>
                      r.kind === "swap" ? (
                        <li key={r.ex.id} className="px-4 py-3" data-testid="adapt-swap">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="text-muted line-through decoration-1">{r.ex.exercise.namePt}</span>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                              {r.ex.exercise.equipment?.namePt} · {r.ex.sets}×{r.ex.repMin === r.ex.repMax ? r.ex.repMin : `${r.ex.repMin}-${r.ex.repMax}`}
                            </span>
                          </p>
                          {r.pick ? (
                            <AdaptSwapChoice
                              name={r.field}
                              original={{ namePt: r.ex.exercise.namePt, equipmentNamePt: r.ex.exercise.equipment?.namePt ?? null }}
                              options={r.options}
                              defaultId={r.pick.id}
                            />
                          ) : (
                            <p className="mt-1.5 text-xs text-warning">
                              Sem substituto com o seu equipamento — fica o original. Dá para trocar depois, no editor.
                              <input type="hidden" name={r.field} value="keep" />
                            </p>
                          )}
                        </li>
                      ) : null,
                    )}
                    {kept.length > 0 ? (
                      <li className="px-4 py-2.5 text-xs text-muted">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
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

          <div className="sticky bottom-[var(--nav-h)] z-20 -mx-4 mt-6 flex items-center gap-2 border-t-2 border-t-[var(--rule-heavy)] bg-background px-4 py-2 sm:bottom-0 sm:-mx-6 sm:justify-end sm:px-6">
            <Button asChild variant="ghost" className="px-3">
              <Link href={templateHref}>Cancelar</Link>
            </Button>
            <SubmitButton variant="strong" className="flex-1 px-4 sm:flex-none" pendingLabel="Salvando…">
              <AdaptSaveLabel />
            </SubmitButton>
          </div>
        </AdaptSwapCounts>
      </InlineActionForm>
    </div>
  );
}
