import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getDietMarks, getDietPlan } from "@/lib/data/diet";
import { getBodyweightPoints, getDayWeightAndWaist } from "@/lib/data/body-metrics";
import { DIET_BACKDATE_DAYS, dietDateText, dietDayName, isoOfDay, parseDietDay } from "@/lib/diet/days";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { weekOverWeek } from "@/lib/training/body-weight";
import { EmptyState } from "@/components/ui/misc";
import { SectionHead } from "@/components/ui/section-head";
import { cn } from "@/lib/utils/cn";
import { DietDay } from "./diet-day";
import { DietBodyLog } from "./diet-body-log";

export const metadata: Metadata = { title: "Dieta" };

const dayHref = (day: number, todayNo: number) => (day === todayNo ? "/app/dieta" : `/app/dieta?dia=${isoOfDay(day)}`);
const DAY_STEP = "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]";
const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The day asked for (?dia=, today by default) and everything shown for it,
 * read in parallel — noting the server time just before the read: a mark the
 * outbox confirms after it is newer than what the page shows (diet-outbox.ts).
 */
async function load(userId: string, dia: string | string[] | undefined) {
  const loadedAtMs = Date.now();
  const todayNo = dayNumberOf(new Date(loadedAtMs));
  const day = parseDietDay(dia, todayNo);
  const [plan, marks, weighIns, body] = await Promise.all([
    getDietPlan(userId),
    getDietMarks(userId, day),
    // This week's and last week's weigh-ins, ending on the day shown.
    getBodyweightPoints(userId, day - 13),
    getDayWeightAndWaist(userId, day),
  ]);
  return { loadedAtMs, todayNo, day, plan, marks, weighIns, body };
}

/**
 * Dieta: the owner's eating plan, one São Paulo day at a time (today, or an
 * earlier day from ?dia= — never a later one): the day's targets and what the
 * eaten items add up to, the meals to mark, the day's weight and waist with
 * the 7-day average, and the plan's swaps and rules. Everything here is the
 * user's alone: nothing reaches the feed, the public profile or a shared link.
 * No plan yet: the page says so (plans are loaded for the account; there is no
 * editor yet) and still logs the weight and waist.
 */
export default async function DietPage({ searchParams }: PageProps<"/app/dieta">) {
  const sp = await searchParams;
  const user = await requireUser();
  const { loadedAtMs, todayNo, day, plan, marks, weighIns, body } = await load(user.id, sp.dia);
  const iso = isoOfDay(day);
  const week = weekOverWeek(weighIns, day);
  const name = dietDayName(day, todayNo);
  const dateText = dietDateText(day, todayNo);
  const canGoBack = day > todayNo - DIET_BACKDATE_DAYS;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/app/profile"
        className="-mt-2 -ml-1.5 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Perfil
      </Link>
      <h1 className="text-display text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">Dieta</h1>
      {plan ? <p className="mt-1 text-[15px] text-foreground/90">{plan.title}</p> : null}
      <p className="mt-1 text-[13px] text-muted">Só você vê. Nada daqui aparece no feed nem no seu perfil.</p>

      <nav aria-label="Dia" className="mt-5 flex items-center gap-2" data-diet-day={iso}>
        {canGoBack ? (
          <Link
            href={dayHref(day - 1, todayNo)}
            aria-label={`Dia anterior, ${dietDateText(day - 1, todayNo)}`}
            className={cn(DAY_STEP, "border border-border-strong bg-surface hover:bg-surface-2")}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={cn(DAY_STEP, "text-muted/40")}>
            <ChevronLeft className="size-5" />
          </span>
        )}
        <p className="min-w-0 flex-1 text-center">
          <span className="block text-[17px] font-semibold leading-snug">{name ?? capitalized(dateText.split(",")[0])}</span>
          <span className="block text-[13px] text-muted">{dateText}</span>
        </p>
        {/* No later day than today: nothing to mark there yet. */}
        {day < todayNo ? (
          <Link
            href={dayHref(day + 1, todayNo)}
            aria-label={`Próximo dia, ${dietDateText(day + 1, todayNo)}`}
            className={cn(DAY_STEP, "border border-border-strong bg-surface hover:bg-surface-2")}
          >
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={cn(DAY_STEP, "text-muted/40")}>
            <ChevronRight className="size-5" />
          </span>
        )}
      </nav>
      {day < todayNo - 1 ? (
        <p className="text-center">
          <Link href="/app/dieta" className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
            Voltar para hoje
          </Link>
        </p>
      ) : null}

      {plan ? (
        <DietDay key={iso} userId={user.id} date={iso} loadedAtMs={loadedAtMs} meals={plan.meals} targets={plan.targets} marks={marks} />
      ) : (
        <div className="mt-5">
          <EmptyState
            title="Nenhum plano alimentar ainda"
            description="Quando um plano for carregado na sua conta, ele aparece aqui: as metas do dia, as refeições para marcar o que você comeu e as substituições."
          />
        </div>
      )}

      <DietBodyLog
        key={`corpo-${iso}`}
        date={iso}
        dayNo={day}
        isToday={day === todayNo}
        dayText={dateText}
        weight={body.weight}
        waist={body.waist}
        week={week}
        goal={plan?.goal}
      />

      {plan && (plan.swaps.length > 0 || plan.rules.length > 0) ? (
        <section className="mt-10" aria-labelledby="dieta-guia">
          <SectionHead id="dieta-guia" label="Substituições e regras" />
          <div className="card mt-3 flex flex-col divide-y divide-border px-4">
            {[
              { key: "swaps", title: "Substituições", lines: plan.swaps },
              { key: "rules", title: "Regras", lines: plan.rules },
            ]
              .filter((g) => g.lines.length > 0)
              .map((g) => (
                <details key={g.key} className="group/guide" data-diet-guide={g.key}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1 text-[15px] font-semibold">{g.title}</span>
                    <span className="text-[13px] tabular-nums text-muted">{g.lines.length}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open/guide:rotate-180" aria-hidden />
                  </summary>
                  <ul className="flex list-disc flex-col gap-1.5 pb-3 pl-5 text-[15px] leading-relaxed">
                    {g.lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </details>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
