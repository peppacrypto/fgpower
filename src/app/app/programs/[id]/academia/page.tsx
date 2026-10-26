import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentSession, requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/data/profile";
import { getUserProgram } from "@/lib/data/user-programs";
import {
  assignStandIns,
  getAlternatives,
  mainGearFirst,
  rankStandIns,
  standInRange,
  type AlternativeExercise,
  type Difficulty,
} from "@/lib/data/alternatives";
import { blockingGear, type GearId } from "@/lib/exercises/gear";
import { GYM_ADJUST_LABEL, gearBlockingAny, gearLabelOf, gearListPt, missingGearFlag } from "@/lib/programming/equipment-needs";
import { isTimedHold } from "@/lib/training/set-plan";
import { AdaptSwapChoice, DaySwapCount, type SwapOption } from "@/components/programs/adapt-swap-choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";
import { plural } from "@/lib/utils/format";
import { GymAdjustForm } from "./gym-adjust-form";

export async function generateMetadata({ params }: PageProps<"/app/programs/[id]/academia">): Promise<Metadata> {
  const { id } = await params;
  const [program, session] = await Promise.all([getUserProgram(id), getCurrentSession()]);
  // Someone else's program is "not found" in the tab too, as on the page.
  return program && program.userId === session?.user.id
    ? { title: `${GYM_ADJUST_LABEL} · ${program.name}` }
    : { title: NOT_FOUND_TITLE };
}

/** How many stand-ins each exercise offers in its "Trocar por" list (as on "Adaptar"). */
const OPTIONS = 5;

interface PlanRow {
  id: string;
  sets: number;
  repMin: number;
  repMax: number;
  notes: string | null;
  exercise: { slug: string; difficulty: Difficulty };
}

/** One exercise of a day, with every row that prescribes it (a lift's top set and its back-off swap together). */
interface DayExercise {
  exerciseId: string;
  exercise: {
    slug: string;
    namePt: string;
    equipmentId: string | null;
    category: string;
    difficulty: Difficulty;
    equipment: { namePt: string } | null;
  };
  rows: PlanRow[];
  /** What the gym lacks to do it (every option of it), empty when it can. */
  blocking: GearId[];
  /** The first row's range, for assignStandIns. */
  repMin: number;
  repMax: number;
}

/** "3×8-12", "3×30 s": a row's prescription, with the range it would take on. */
function prescription(row: PlanRow, range: { repMin: number; repMax: number } = row, timed?: boolean): string {
  const seconds = timed ?? isTimedHold({ slug: row.exercise.slug, notes: row.notes });
  const reps = range.repMin === range.repMax ? `${range.repMin}` : `${range.repMin}-${range.repMax}`;
  return `${row.sets}×${reps}${seconds ? " s" : ""}`;
}

/**
 * What picking `sub` does to these rows, said once ("Variação mais difícil:
 * 3×3 + 2×6, parando 1–2 antes da falha.") — exactly what applyGymStandIns
 * will write (alternatives standInRange); null when their ranges stay.
 */
function rangeNote(rows: PlanRow[], sub: { slug: string; difficulty: Difficulty }): string | null {
  const changes = rows.map((row) => ({ row, range: standInRange(row, sub) }));
  const shift = changes.find((c) => c.range.shift)?.range.shift ?? null;
  if (!shift) return null;
  const timed = isTimedHold({ slug: sub.slug });
  const list = changes.map(({ row, range }) => prescription(row, range, timed)).join(" + ");
  switch (shift) {
    case "harder":
      return `Variação mais difícil: ${list}, parando 1–2 antes da falha.`;
    case "easier":
      return `Variação mais fácil: ${list}.`;
    case "seconds":
      return `Feito em segundos: ${list}.`;
    case "reps":
      return `Feito em repetições: ${list}.`;
  }
}

/** A stand-in as the choice shows it: named by its apparatus ("Leg press") when it has one, with what it does to the rows. */
function swapOption(a: AlternativeExercise, rows: PlanRow[]): SwapOption {
  return {
    id: a.id,
    namePt: a.namePt,
    equipmentNamePt: gearLabelOf(a) ?? a.equipmentNamePt,
    imageUrl: a.imageUrl,
    reason: a.reason,
    note: rangeNote(rows, a),
  };
}

/**
 * "Ajustar à minha academia": the user's own program without the apparatus
 * their gym doesn't have (Settings → Minha academia, or "Não tenho este
 * aparelho" in a workout). Every exercise whose every option the gym lacks is
 * listed by day with what it lacks and a stand-in — the "Adaptar" review's
 * machinery (lib/data/alternatives: curated alternatives first, then the same
 * muscle and movement; only what the gym can do and the access level covers;
 * never one the day already has, nor the same one twice in a day). Each can be
 * changed or kept; "Salvar" writes them into this program for the coming weeks
 * (actions/program-gear applyGymStandIns) and lands back on it. Workouts
 * already done keep what was trained. The page checks the user itself — a
 * layout never stands in for that — and someone else's program is not found.
 */
export default async function GymAdjustPage({ params, searchParams }: PageProps<"/app/programs/[id]/academia">) {
  const { id } = await params;
  const changed = (await searchParams).mudou === "1";
  const user = await requireUser();
  const [program, profile] = await Promise.all([
    prisma.userProgram.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        name: true,
        days: {
          orderBy: { dayIndex: "asc" },
          select: {
            id: true,
            name: true,
            exercises: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                exerciseId: true,
                sets: true,
                repMin: true,
                repMax: true,
                notes: true,
                exercise: {
                  select: {
                    slug: true,
                    namePt: true,
                    equipmentId: true,
                    category: true,
                    difficulty: true,
                    equipment: { select: { namePt: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getProfile(user.id),
  ]);
  if (!program) notFound();
  const programHref = `/app/programs/${program.id}`;
  const access = profile?.equipmentAccess ?? "FULL_GYM";
  const missingGear = profile?.missingGear ?? [];

  const days = program.days.map((day) => {
    const byExercise = new Map<string, DayExercise>();
    for (const row of day.exercises) {
      const entry = byExercise.get(row.exerciseId);
      if (entry) entry.rows.push(row);
      else
        byExercise.set(row.exerciseId, {
          exerciseId: row.exerciseId,
          exercise: row.exercise,
          rows: [row],
          blocking: blockingGear(row.exercise, missingGear),
          repMin: row.repMin,
          repMax: row.repMax,
        });
    }
    return { day, exercises: [...byExercise.values()] };
  });

  // Stand-ins per exercise (once each, however many days use it).
  const needing = [
    ...new Set(days.flatMap((d) => d.exercises.filter((e) => e.blocking.length > 0).map((e) => e.exerciseId))),
  ];
  const alternatives = new Map<string, AlternativeExercise[]>(
    await Promise.all(
      needing.map(
        async (exerciseId) =>
          [exerciseId, await getAlternatives(exerciseId, { equipmentAccess: access, missingGear, limit: OPTIONS + 3 })] as const,
      ),
    ),
  );

  const plan = days.flatMap(({ day, exercises }) => {
    const inDay = new Set(exercises.map((e) => e.exerciseId));
    const swaps = assignStandIns(
      exercises.map((e) => ({
        ex: e,
        exerciseId: e.exerciseId,
        usableNow: e.blocking.length === 0,
        difficulty: e.exercise.difficulty,
        candidates: rankStandIns(
          mainGearFirst((alternatives.get(e.exerciseId) ?? []).filter((a) => !inDay.has(a.id)), access),
          e.exercise.difficulty,
        ),
      })),
      OPTIONS,
    )
      .filter((a) => a.kind === "swap")
      .map((a) => ({
        entry: a.ex,
        pick: a.pick,
        options: a.options.map((o) => swapOption(o, a.ex.rows)),
        // actions/program-gear: the exercise shown and every row of the day that prescribes it.
        field: `swap:${a.ex.exerciseId}:${a.ex.rows.map((r) => r.id).join(",")}`,
      }));
    const kept = exercises.filter((e) => e.blocking.length === 0);
    return swaps.length > 0 ? [{ day, swaps, kept }] : [];
  });
  const swaps = plan.flatMap((d) => d.swaps);
  const withStandIn = swaps.filter((s) => s.pick).map((s) => s.field);
  const lacked = gearBlockingAny(swaps.map((s) => s.entry.exercise), missingGear);
  // Settings → Minha academia → Aparelhos: where the gym's missing gear is kept.
  const settingsLink = (
    <Link href="/app/settings#aparelhos" className="font-semibold text-accent hover:underline">
      Configurações → Minha academia
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6 pt-3 sm:px-6 sm:py-8">
      <Link
        href={programHref}
        className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {program.name}
      </Link>

      <p className="eyebrow mt-3">{swaps.length > 0 ? "Sua academia · revise antes de salvar" : "Sua academia"}</p>
      <h1 className="text-display mt-0.5 text-[1.75rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[2rem]">
        {GYM_ADJUST_LABEL}
      </h1>

      {swaps.length === 0 ? (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {missingGear.length === 0
              ? "Você não marcou nenhum aparelho que falte na sua academia — não há o que ajustar."
              : "Nada a ajustar: todos os exercícios deste programa cabem na sua academia."}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            O que a sua academia não tem fica em {settingsLink}.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href={programHref}>Voltar ao programa</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {`${plural(swaps.length, "exercício pede", "exercícios pedem")} ${lacked.length === 1 ? "um aparelho" : "aparelhos"} que a sua academia não tem (${gearListPt(lacked)})${plan.length > 1 ? `, em ${plural(plan.length, "dia", "dias")}` : ""}. Sugerimos uma troca para ${withStandIn.length < swaps.length ? "os que têm substituto" : "cada um"} — mesmo músculo e movimento, com o que a sua academia tem. Séries e descanso seguem o plano; ajustamos as repetições quando o substituto é mais difícil ou mais fácil.`}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            Salvar muda este programa a partir do próximo treino; os treinos já feitos não mudam. O que a sua academia não tem
            fica em {settingsLink}.
          </p>
          {changed ? (
            <p role="status" className="mt-4 rounded-[var(--radius-md)] bg-warning-soft px-4 py-3 text-sm">
              O programa ou a sua academia mudou enquanto você revisava. Confira as trocas abaixo e salve de novo.
            </p>
          ) : null}

          <GymAdjustForm programId={program.id} cancelHref={programHref} initial={withStandIn}>
            <div className="mt-6 flex flex-col gap-4">
              {plan.map(({ day, swaps: daySwaps, kept }) => (
                <section key={day.id} aria-labelledby={`gym-day-${day.id}`} className="card overflow-hidden">
                  <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                    <h2 id={`gym-day-${day.id}`} className="min-w-0 text-base font-semibold leading-snug wrap-break-word">
                      {day.name}
                    </h2>
                    <span className="shrink-0 text-[13px] tabular-nums text-muted">
                      <DaySwapCount names={daySwaps.filter((s) => s.pick).map((s) => s.field)} />
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {daySwaps.map((s) => (
                      <li key={s.field} className="px-4 py-3.5 sm:px-5" data-testid="gym-swap">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="text-muted line-through decoration-1">{s.entry.exercise.namePt}</span>
                          <span className="text-[13px] tabular-nums text-muted">
                            {s.entry.rows.map((r) => prescription(r)).join(" + ")}
                          </span>
                        </p>
                        <Badge variant="warning" className="mt-1.5">
                          {missingGearFlag(s.entry.blocking)}
                        </Badge>
                        {s.pick ? (
                          <AdaptSwapChoice
                            name={s.field}
                            original={{
                              namePt: s.entry.exercise.namePt,
                              equipmentNamePt: gearLabelOf(s.entry.exercise) ?? s.entry.exercise.equipment?.namePt ?? null,
                            }}
                            options={s.options}
                            defaultId={s.pick.id}
                          />
                        ) : (
                          <p className="mt-1.5 text-[13px] leading-snug text-warning">
                            Sem substituto que a sua academia tenha — fica o original. Dá para trocar depois, no editor.
                            <input type="hidden" name={s.field} value="keep" />
                          </p>
                        )}
                      </li>
                    ))}
                    {kept.length > 0 ? (
                      <li className="px-4 py-3 text-[13px] leading-snug text-muted sm:px-5">
                        <span className="font-semibold text-foreground">Mantidos ({kept.length})</span>{" "}
                        {kept.map((e) => e.exercise.namePt).join(" · ")}
                      </li>
                    ) : null}
                  </ul>
                </section>
              ))}
            </div>
          </GymAdjustForm>
        </>
      )}
    </div>
  );
}
