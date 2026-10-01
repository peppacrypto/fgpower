import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { GArrow, Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import {
  HIGH_WEEKLY_DIRECT_SETS,
  LOW_WEEKLY_SETS,
  WELCOME_BACK_AFTER_DAYS,
  findUndoableSwitch,
  getActiveEnrollment,
  getDaysDoneThisWeek,
  getInProgressSessions,
  getLastWeekReview,
  getRecentPersonalRecords,
  getTodayHabit,
  getWeeklyProgress,
} from "@/lib/data/dashboard";
import { getBlockProgress, getRecentlyCompletedBlock, getSeriesContinuation } from "@/lib/data/program-lifecycle";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionHead } from "@/components/ui/section-head";
import { DayActions, DayStatus, dayStates, exerciseCount } from "@/components/workout/day-actions";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import { formatKg, formatNumber, plural } from "@/lib/utils/format";
import { formatSet, isTimedHold } from "@/lib/training/set-plan";
import { listTemplates, recommendProfileOf, toCatalogItem } from "@/lib/data/templates";
import { recommendTemplates } from "@/lib/programming/recommend";
import { trainingWeekdays } from "@/lib/programming/schedule";
import { RecommendedPanel } from "@/components/programs/recommended-panel";
import { APP_TIME_ZONE, wallClock } from "@/lib/training/week";
import {
  dayNumberOf,
  mondayOf,
  planWeek,
  plannedWeekdays,
  repeatsDays,
  upcomingWorkout,
  weekStrip,
  weekdayName,
} from "@/lib/training/day-rotation";
import { seriesPosition } from "@/lib/training/program-calendar";
import {
  appliedDeloadGuidance,
  completeWeekDone,
  effectiveProgramWeek,
  getWeekGuidance,
  programWeekView,
  thisWeekRule,
} from "@/lib/training/week-guidance";
import { isAppliedDeload } from "@/lib/training/deload";
import { GD_SERIES } from "@/lib/training/program-calendar";
import { measurementWeek } from "@/lib/training/body-weight";
import { fatigueDismissalKey, getFatigueSignal } from "@/lib/data/fatigue";
import { getBodyweightGlance } from "@/lib/data/body-metrics";
import { ResumeProgramPanel } from "@/components/programs/resume-program-panel";
import { formatSpDate, formatSpDaysAgo, spDaysBetween } from "@/lib/training/stale";
import { restorePreviousProgram } from "@/lib/actions/programs";
import { StaleSessionRow } from "./stale-session-row";
import { ResumeWorkout } from "./resume-workout";
import { ClearParams } from "./clear-params";
import { BlockCompletedHero, InProgressBlock, NextWorkoutHero, RestDayHero, WeekCompleteHero } from "./heroes";
import { ProgramCard, ThisWeekCard, streakText } from "./week-cards";
import { nudgeDaysLeft } from "./streak-nudge";
import { WeekReviewFrame } from "./week-review";
import { WEEK_REVIEW_COOKIE, WEEK_START_COOKIE, readWeekStart } from "./week-start";
import { getEnrollmentProgress } from "@/lib/data/user-programs";
import { NotificationsBell } from "@/components/nav/notifications-bell";
import { TeamStrip } from "./team-strip";
import { FatigueCard } from "./fatigue-card";
import { WeighInRow } from "./weigh-in-row";

export const metadata: Metadata = { title: "Hoje" };

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
/** One-time notice params, cleared from the URL once shown. */
const NOTICE_PARAMS = ["ativado", "anterior", "descartado", "salvo", "retomado", "excluido", "deload"];
/** A workout touched this recently is the one to go back to when the app reopens on Today (W-097). */
const RESUME_WITHIN_MS = 3 * 60 * 60 * 1000;

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** What each record kind is called in a PR row ("Carga · 1RM estimado"); a hold's rep record is its time. */
function prText(kind: string, timed: boolean): string | null {
  switch (kind) {
    case "MAX_WEIGHT":
      return "Carga";
    case "ESTIMATED_1RM":
      // A hold's e1RM means nothing (progress-core describePr).
      return timed ? null : "1RM estimado";
    case "MAX_REPS_AT_WEIGHT":
      return timed ? "Tempo" : "Repetições";
    default:
      return null;
  }
}

type PrRecord = { kind: string; value: number; weightKg: number | null; reps: number | null };

/** A record's value: "62,5 kg"; a bodyweight rep record "15 reps"; a hold "45 s", "10 kg × 40 s". */
function prValue(r: PrRecord, timed: boolean): string {
  if (r.kind !== "MAX_REPS_AT_WEIGHT") return formatKg(r.value);
  const reps = r.reps ?? r.value;
  if (timed) return formatSet(r.weightKg ?? 0, reps, { timed: true });
  return r.weightKg === 0 ? plural(reps, "rep", "reps") : `${formatKg(r.weightKg)} × ${reps}`;
}

/**
 * A PR row (L-bodyweight-timed-display): the lead record's value and the
 * kinds line ("1RM estimado · Repetições", "Repetições · peso corporal").
 * A hold leads with its time and never lists a 1RM — a hold whose only new
 * record is an estimated 1RM (a short loaded hold) has no row (null).
 */
function prRow(pr: { records: PrRecord[]; exercise: { slug: string } }) {
  const timed = isTimedHold({ slug: pr.exercise.slug });
  const shown = pr.records.filter((r) => prText(r.kind, timed) != null);
  const lead = (timed ? shown.find((r) => r.kind === "MAX_REPS_AT_WEIGHT") : undefined) ?? shown[0];
  if (!lead) return null;
  const kinds = [lead, ...shown.filter((r) => r !== lead)].map((r) => prText(r.kind, timed)).filter((t): t is string => t != null);
  const bodyweight = !timed && lead.kind === "MAX_REPS_AT_WEIGHT" && lead.weightKg === 0;
  return { value: prValue(lead, timed), kinds: bodyweight ? [...kinds, "peso corporal"] : kinds };
}

export default async function TodayPage({ searchParams }: PageProps<"/app/today">) {
  const sp = await searchParams;
  const param = (key: string) => (typeof sp[key] === "string" ? sp[key] : undefined);
  const justActivated = param("ativado") === "1";
  const previousEnrollmentId = param("anterior");
  const savedSessionId = param("salvo");
  const user = await requireUser();
  const now = new Date();
  // First: it closes a block whose last week is over, so what's active below is current.
  const completedBlock = await getRecentlyCompletedBlock(user.id, now);
  const [profile, enrollment, inProgress, weeklyCount, recentPrs, cookieStore] = await Promise.all([
    getProfile(user.id),
    getActiveEnrollment(user.id),
    getInProgressSessions(user.id, now),
    getWeeklyProgress(user.id),
    getRecentPersonalRecords(user.id),
    cookies(),
  ]);
  const days = enrollment?.program.days ?? [];
  const todayNo = dayNumberOf(now);
  const wall = wallClock(now, APP_TIME_ZONE);
  const weekKey = String(mondayOf(todayNo));
  // Monday and Tuesday close out last week (W-129), unless closed for this week on this device.
  const reviewDay = wall.weekday === 1 || wall.weekday === 2;
  const reviewClosed = cookieStore.get(WEEK_REVIEW_COOKIE)?.value === weekKey;
  const noProgram = !enrollment && !completedBlock;
  const [done, undo, saved, templates, habit, review, progress, continuation] = await Promise.all([
    enrollment
      ? getDaysDoneThisWeek(user.id, enrollment.id, days)
      : { byDayId: new Map<string, string>(), sessionCount: 0 },
    // "Voltar para …" right after a program switch (one-time, within 24 h).
    enrollment && previousEnrollmentId ? findUndoableSwitch(prisma, user.id, previousEnrollmentId, now) : null,
    // "Salvar como feito em dd/mm" lands here with the saved workout.
    savedSessionId
      ? prisma.workoutSession.findFirst({
          where: { id: savedSessionId, userId: user.id, status: "COMPLETED" },
          select: { id: true, finishedAt: true },
        })
      : null,
    // No program running: what to start with, from the onboarding answers (and where the GD series goes on).
    noProgram ? listTemplates() : null,
    getTodayHabit(user.id, enrollment, now),
    reviewDay && !reviewClosed ? getLastWeekReview(user.id, now) : null,
    enrollment
      ? getBlockProgress(prisma, user.id, {
          id: enrollment.id,
          currentWeek: enrollment.currentWeek,
          startedAt: enrollment.startedAt,
          program: {
            durationWeeks: enrollment.program.durationWeeks,
            daysPerWeek: enrollment.program.daysPerWeek,
            dayCount: days.length,
          },
        })
      : null,
    // No program running: the GD series' next block, or the program stopped mid-block ("Retomar").
    noProgram ? getSeriesContinuation(user.id, now) : null,
  ]);
  // Where the program switched away from would resume (entry week and last-week resumes included).
  const undoProgress = undo ? await getEnrollmentProgress(undo.previous, now) : null;
  const doneThisWeek = done.byDayId;

  // A workout left open on an earlier day (or for hours) and not touched
  // since is shown as a compact "não finalizado" row; it doesn't take the
  // hero or lock the day list. One with nothing on the server is an abandoned
  // start (the next start discards it): its row only appears if this device
  // still holds sets typed offline for it.
  const stale = inProgress.filter((s) => s.stale);
  const open = inProgress.filter((s) => !s.stale);
  // The app reopened mid-workout (W-097): the first Today of the visit goes back to the one
  // workout being logged in the last few hours — never over a one-time notice.
  const resumable = open.filter(
    (s) => s.hasData && s.lastActivityAt && now.getTime() - s.lastActivityAt.getTime() < RESUME_WITHIN_MS,
  );
  const resumeId = resumable.length === 1 && !NOTICE_PARAMS.some((k) => param(k) !== undefined) ? resumable[0].id : null;

  const firstName = (profile?.displayName ?? user.name).split(" ")[0];

  // Where the program stands this week: the program week the next workout
  // counts in, a Thursday–Sunday entry week, and that week's guidance.
  const own = habit.program;
  const templateSlug = enrollment?.program.sourceTemplate?.slug ?? null;
  const effectiveWeek = enrollment
    ? effectiveProgramWeek({
        currentWeek: enrollment.currentWeek,
        sessionsThisWeek: done.sessionCount,
        trainedBefore: own?.trainedBefore ?? false,
      })
    : 1;
  const weekView = enrollment
    ? programWeekView({ startedAt: enrollment.startedAt, now, effectiveWeek, entryWeekTrained: own?.entryWeekTrained ?? false })
    : null;
  const entry = weekView?.kind === "entry" ? { daysLeft: weekView.daysLeft } : null;
  const streak = habit.streak;
  // The entry week's target (activation day → Sunday), and whether this week already counts through
  // another program (a block finished this week, the program switched from): then it's complete.
  const rule = enrollment
    ? thisWeekRule({ view: weekView, enrollmentId: enrollment.id, thisWeek: streak.thisWeek })
    : { targetCap: null, alreadyCounts: false };
  const plannedGuidance = enrollment
    ? getWeekGuidance(enrollment.program.weeklyGuidance, weekView?.guidanceWeek ?? 1, {
        templateSlug,
        durationWeeks: enrollment.program.durationWeeks,
      })
    : null;
  // A week the user turned into a deload (W-128) reads as one everywhere on Today: the program
  // card's "Deload" and instructions, "Semana de deload: 1 treino já conta" (lib/training/deload).
  const appliedDeload = enrollment ? isAppliedDeload(enrollment.deloadMondays, mondayOf(todayNo)) : false;
  const guidance = appliedDeload ? appliedDeloadGuidance(plannedGuidance, weekView?.guidanceWeek ?? 1) : plannedGuidance;

  // The hero suggests the next day not yet trained this week, on the user's
  // week (lib/training/day-rotation: planWeek's rotation — the rule the
  // workout summary's "Próximo treino" uses too — dated by upcomingWorkout).
  // A day left open on an earlier date is handled by its own row above (save
  // it on its day, continue or discard) — never suggested again next to it,
  // which would start a second copy.
  const staleDayIds = new Set(
    [...dayStates(days, stale, new Map()).entries()].filter(([, st]) => st.kind === "in-progress").map(([id]) => id),
  );
  const isTrainable = (d: (typeof days)[number]) => d.exercises.length > 0;
  const daysPerWeek = enrollment?.program.daysPerWeek ?? 0;
  const rotation = { days, isTrainable, nextDayIndex: enrollment?.nextDayIndex, daysPerWeek };
  // A week after one that stopped mid-plan: continue the sequence or start
  // over (W-089) — and what next week will start with, for a date promised
  // into it (dashboard getTodayHabit: the summary reads the same).
  const choice = enrollment ? (own?.weekStart ?? null) : null;
  const pick =
    choice && enrollment
      ? (readWeekStart(cookieStore.get(WEEK_START_COOKIE)?.value, enrollment.id, weekKey) ?? choice.byDefault)
      : null;
  // The user's week: the days' planned weekdays; a plan that repeats its days
  // (A/B at 3×) is trained on the profile's days (programming/schedule).
  const preferredDays = profile?.preferredDays ?? [];
  const schedule = repeatsDays(daysPerWeek, days.length)
    ? trainingWeekdays(daysPerWeek, preferredDays)
    : preferredDays;
  const lastDoneNo = habit.lastSession ? dayNumberOf(habit.lastSession.finishedAt) : null;
  const weekInput = {
    ...rotation,
    doneDayIds: doneThisWeek,
    sessionCount: done.sessionCount,
    skipDayIds: staleDayIds,
    carryOver: pick === "continue",
  };
  const up = upcomingWorkout({
    ...weekInput,
    // A week that already counts: nothing is asked of it — the next workout is next week's first.
    ...(rule.alreadyCounts ? completeWeekDone(days.filter(isTrainable).map((d) => d.id)) : {}),
    targetCap: rule.targetCap,
    todayNo,
    lastDoneNo,
    preferredDays: schedule,
    carryOverNextWeek: own?.nextWeekCarryOver ?? false,
  });
  const plan = up.week;
  const nextDay = plan.nextDay ?? undefined;
  const weekComplete = plan.weekComplete;
  const trainedToday = lastDoneNo === todayNo;
  // Only a workout with something logged blocks starting another day (the
  // server discards untouched open sessions when a new day starts).
  const locked = open.some((s) => s.hasData);
  // With a plan, "Esta semana" counts what the plan counts: distinct days, plus
  // repeats only where the plan repeats days (A/B at 3×) — a redo isn't a new
  // workout — never cut to an entry week's cap. A week that already counts
  // through another program shows that week's count (the streak's row).
  const hasPlan = days.some((d) => d.exercises.length > 0);
  const weeklyTarget = rule.alreadyCounts
    ? streak.thisWeek.target
    : hasPlan
      ? plan.weeklyTarget
      : (profile?.daysPerWeek ?? 3);
  const weeklyDone = rule.alreadyCounts
    ? streak.thisWeek.done
    : hasPlan
      ? Math.max(plan.weeklyDone, rule.targetCap != null ? planWeek(weekInput).weeklyDone : 0)
      : weeklyCount;
  // Stale sessions included: their day's row continues that session instead
  // of offering a fresh "Iniciar".
  const states = dayStates(days, [...open, ...stale], doneThisWeek);
  const dateStr = `${WEEKDAYS[wall.weekday]} · ${String(wall.day).padStart(2, "0")} ${MONTHS[wall.month - 1]}`;
  const editHref = enrollment ? `/app/programs/${enrollment.programId}/edit` : "/app/programs";
  const answers = recommendProfileOf(profile);
  const picks =
    templates && answers
      ? recommendTemplates(answers, templates.map(toCatalogItem), {
          finishedGd: continuation?.finishedGd,
          stoppedGd: continuation?.resume?.templateSlug,
        })
          .slice(0, 3)
          .map((r) => ({
            slug: r.template.slug,
            namePt: r.template.namePt,
            taglinePt: r.template.taglinePt,
            reasons: r.reasons,
          }))
      : [];

  // The masthead's dateline and the welcome back after a gap (W-053).
  const last = habit.lastSession;
  const daysAway = last ? spDaysBetween(last.finishedAt, now) : 0;
  const welcomeBack = last && daysAway >= WELCOME_BACK_AFTER_DAYS && open.length === 0;
  const trainable = days.filter(isTrainable);
  const position = nextDay && trainable.length > 1 ? { n: trainable.indexOf(nextDay) + 1, of: trainable.length } : null;
  const plannedDays = enrollment ? plannedWeekdays(trainable, schedule) : new Set(preferredDays);
  // Today is one of the user's training days (not just the day a catch-up or an entry week suggests).
  const scheduledToday =
    plannedDays.has(wall.weekday) && (!enrollment || todayNo >= dayNumberOf(enrollment.startedAt));
  const strip = weekStrip({
    todayNo,
    planned: plannedDays,
    doneDayNos: habit.doneDayNos,
    fromNo: enrollment ? dayNumberOf(enrollment.startedAt) : null,
    // The hero's day is a training day on the strip too (an entry week, a catch-up).
    suggestedNo: open.length === 0 && !completedBlock && up.next && !up.next.nextWeek ? up.next.dayNo : null,
  });
  const series = seriesPosition(templateSlug);
  const lastWeekRow = streak.lastWeek;

  // The optional prompts — at most one per visit: the fatigue signal (W-128), else today's
  // weigh-in (W-083), else the team invite (W-139). The fatigue card waits while a workout is
  // open, after a gap (the welcome back says it) and when a block just ended.
  const measure = enrollment
    ? measurementWeek({ templateSlug, week: weekView?.guidanceWeek ?? 1, durationWeeks: enrollment.program.durationWeeks })
    : null;
  const [signal, dismissed, glance] = await Promise.all([
    enrollment && weekView && open.length === 0 && !welcomeBack && !completedBlock
      ? getFatigueSignal(user.id, enrollment, {
          now,
          weekView,
          guidance: plannedGuidance,
          lastWeekDeload: lastWeekRow?.deload === true,
          entryWeekTrained: own?.entryWeekTrained ?? false,
        })
      : null,
    enrollment
      ? prisma.userDismissal.findUnique({
          where: { userId_key: { userId: user.id, key: fatigueDismissalKey(enrollment.id, weekKey) } },
          select: { key: true },
        })
      : null,
    getBodyweightGlance(user.id, now),
  ]);
  const prRows = recentPrs.flatMap((pr) => {
    const row = prRow(pr);
    return row ? [{ pr, row }] : [];
  });
  // "Agora não" / "Entendi" close this week's signal; an applied deload always shows.
  const fatigue = signal && (signal.level === "applied" || !dismissed) ? signal : null;
  // In a week that asks for body data, the row stays for the day (saved: "PESO HOJE 81,4 KG");
  // for the weigh-in habit, only until today's is in.
  const showWeighIn = !fatigue && (measure != null || glance.weighedRecently) && (measure != null || glance.todayKg == null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <ClearParams keys={NOTICE_PARAMS} />
      {resumeId ? <ResumeWorkout sessionId={resumeId} /> : null}
      {/* Masthead (the notifications bell on its right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{dateStr}</span>
          <h1 className="text-display mt-1 text-3xl font-extrabold sm:text-4xl">
            {greeting(wall.hour)}, {firstName}.
          </h1>
          {last ? (
            <p className="mt-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted" data-last-workout>
              Último treino · <span className="text-foreground/80">{last.name}</span> ·{" "}
              <span className="whitespace-nowrap">{formatSpDaysAgo(last.finishedAt, now)}</span>
            </p>
          ) : null}
        </div>
        <NotificationsBell />
      </div>

      {/* One-time outcome notices (the params are cleared once shown) */}
      {param("descartado") === "1" ? <Notice>Treino descartado.</Notice> : null}
      {param("excluido") === "1" ? <Notice>Treino excluído do histórico.</Notice> : null}
      {saved?.finishedAt ? (
        <Notice>
          <span>Treino de {formatSpDate(saved.finishedAt)} salvo no histórico.</span>
          <Link href={`/app/workout/${saved.id}/summary`} className="inline-flex items-center gap-1 text-accent">
            Ver
            <GArrow className="size-3" />
          </Link>
        </Notice>
      ) : null}
      {param("deload") === "aplicado" ? <Notice>Deload aplicado nesta semana.</Notice> : null}
      {param("deload") === "desfeito" ? <Notice>Deload desfeito.</Notice> : null}
      {param("retomado") === "1" && enrollment ? (
        <Notice>
          {enrollment.program.name} retomado ·{" "}
          {weekView?.kind === "week" ? `semana ${weekView.week}` : "semana de entrada"}
        </Notice>
      ) : null}
      {undo ? (
        <div className="mt-6 border-l-2 border-l-accent bg-surface-2 px-3 py-2.5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Programa trocado</p>
          <p className="mt-0.5 text-xs text-muted">
            {undo.previous.program.name} continua na {undoProgress}, de onde você parou.
          </p>
          <InlineActionForm
            action={restorePreviousProgram.bind(null, undo.previous.id)}
            failText="Não foi possível voltar. Tente de novo."
            className="mt-2"
            errorClassName="mt-1.5"
          >
            <SubmitButton size="sm" variant="outline" pendingLabel="Voltando…" className="h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-left">
              Voltar para {undo.previous.program.name}
            </SubmitButton>
          </InlineActionForm>
        </div>
      ) : null}

      {welcomeBack ? (
        <div className="mt-6 border-l-2 border-l-accent bg-accent-soft px-3 py-2.5 text-xs" data-welcome-back>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Bem-vindo de volta</p>
          <p className="mt-1 text-foreground/90">
            {daysAway} dias desde o último treino. Nos primeiros 1–2 treinos, comece com ~90% das cargas e deixe 1 rep a
            mais na reserva (RIR +1): a força volta rápido.{" "}
            <Link href="/app/science/deloads" className="font-semibold text-accent underline underline-offset-2">
              Por quê?
            </Link>
          </p>
        </div>
      ) : null}

      {/* Focus block */}
      <div className="mt-8 flex flex-col gap-3">
        {stale.map((session) => (
          <StaleSessionRow
            key={session.id}
            sessionId={session.id}
            name={session.name}
            setsDone={session.registered}
            onServer={session.hasData}
            dayLabel={formatSpDate(session.saveAs.finishedAt)}
          />
        ))}
        {open.length > 0 ? (
          open.map((session) => (
            <InProgressBlock
              key={session.id}
              sessionId={session.id}
              name={session.name}
              setsDone={session.registered}
              startedAt={session.startedAt}
              now={now}
            />
          ))
        ) : completedBlock ? (
          <BlockCompletedHero block={completedBlock} />
        ) : nextDay && up.restToday && up.next ? (
          <RestDayHero
            next={up.next}
            todayNo={todayNo}
            trainedToday={trainedToday}
            todaySessionId={trainedToday && last ? last.id : null}
            startDay={nextDay}
          />
        ) : nextDay ? (
          <NextWorkoutHero
            day={nextDay}
            justActivated={justActivated}
            position={position}
            plannedToday={!entry && up.next?.isToday && scheduledToday ? weekdayName(wall.weekday) : null}
            weekStart={
              choice && pick && enrollment
                ? {
                    leftover: choice.leftover.map((d) => d.name),
                    afterEntryWeek: choice.afterEntryWeek,
                    pick,
                    firstDayName: trainable[0]?.name ?? "",
                    enrollmentId: enrollment.id,
                    weekKey,
                  }
                : null
            }
          />
        ) : weekComplete ? (
          <WeekCompleteHero
            next={up.next}
            todayNo={todayNo}
            kind={rule.alreadyCounts ? "counted" : entry ? "entry" : "week"}
            programName={enrollment?.program.name ?? null}
          />
        ) : enrollment && hasPlan ? (
          // Every day with exercises is left open: the rows above save, continue or discard them.
          <p className="px-1 text-sm text-muted">
            Salve ou descarte {stale.length === 1 ? "o treino não finalizado" : "os treinos não finalizados"} para seguir o
            programa.
          </p>
        ) : enrollment ? (
          <div className="border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 p-8 text-center">
            <p className="text-display text-2xl font-bold">Programa sem exercícios.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {enrollment.program.name} ainda não tem nada para treinar. Adicione ao menos um exercício, ou escolha um
              programa pronto.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="strong" asChild>
                <Link href={editHref}>Adicionar exercícios</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/programs">Explorar programas</Link>
              </Button>
            </div>
          </div>
        ) : continuation?.resume ? (
          // No program running, one stopped mid-block: it picks up where it was (the library is a tap away).
          <ResumeProgramPanel resume={continuation.resume} showLibraryLink />
        ) : picks.length > 0 ? (
          // No program yet: the onboarding answers pay off — one pick (after a finished GD block,
          // the series' next one), why, and one tap to the first set.
          <RecommendedPanel picks={picks} fatLoss={answers?.goal === "FAT_LOSS"} showLinks />
        ) : (
          <div className="border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 p-8 text-center">
            <p className="text-display text-2xl font-bold">Sem programa ativo.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Escolha um programa pronto ou monte o seu para começar a treinar.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="strong" asChild>
                <Link href="/app/programs">Explorar programas</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/programs/new">Criar do zero</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* A fatigue signal or an applied deload (W-128). Closed this week, it's still rendered — as
          its live region alone — so the re-render right after "Agora não" keeps that said, and the
          focus where the card was (FatigueFrame). */}
      {signal ? (
        <FatigueCard
          signal={signal}
          dismissed={fatigue == null}
          arrived={param("deload") === "aplicado" || param("deload") === "desfeito"}
          gd={templateSlug != null && (GD_SERIES as readonly string[]).includes(templateSlug)}
        />
      ) : null}

      {/* Monday/Tuesday: last week, closed out (W-129) */}
      {review && lastWeekRow && lastWeekRow.trained ? (
        <div className="mt-6">
          <WeekReviewFrame
            weekKey={weekKey}
            label={
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Semana anterior</span>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
                  {lastWeekRow.done}
                  <span className="text-base text-muted"> / {lastWeekRow.target}</span>
                  <span className="ml-2 align-middle font-sans text-[10px] font-bold uppercase tracking-wider text-muted">
                    treinos
                  </span>
                </p>
              </>
            }
          >
            <ul className="mt-2 flex flex-col gap-1 text-xs text-foreground/90">
              {streakText(streak.current, streak.best) ? (
                <li className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                  {streakText(streak.current, streak.best)}
                </li>
              ) : null}
              {lastWeekRow.deload ? <li>Semana de deload: leve de propósito.</li> : null}
              <li>
                {review.recordExercises.length === 0 ? (
                  "Nenhum recorde novo — normal fora das semanas mais duras."
                ) : (
                  <>
                    {plural(review.recordExercises.length, "recorde", "recordes")}:{" "}
                    {review.recordExercises.slice(0, 3).map((e, i) => (
                      <span key={e.slug}>
                        {i > 0 ? ", " : ""}
                        <Link href={`/app/exercises/${e.slug}/history`} className="font-semibold hover:text-accent">
                          {e.namePt}
                        </Link>
                      </span>
                    ))}
                    {review.recordExercises.length > 3 ? ` e mais ${review.recordExercises.length - 3}` : ""}
                  </>
                )}
              </li>
            </ul>
            {review.muscles.length > 0 ? (
              <details className="group/muscles mt-2 border-t border-border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-semibold text-accent [&::-webkit-details-marker]:hidden">
                  Séries por músculo
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted group-open/muscles:hidden">
                    ver
                  </span>
                </summary>
                <ul className="grid grid-cols-1 gap-x-6 pb-1 min-[420px]:grid-cols-2">
                  {review.muscles.slice(0, 8).map((m) => (
                    <li key={m.name} className="flex items-baseline justify-between gap-3 border-t border-border py-1.5 text-xs">
                      <span className="min-w-0 truncate">{m.name}</span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {formatNumber(m.sets, 1)}
                        {m.low ? <span className="ml-1 text-muted">· abaixo de {LOW_WEEKLY_SETS}</span> : null}
                        {m.high ? <span className="ml-1 text-muted">· acima de {HIGH_WEEKLY_DIRECT_SETS} diretas</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="pb-2 text-[11px] text-muted">
                  Séries diretas, mais meia série onde o músculo só ajuda. Referência do app: abaixo de{" "}
                  {LOW_WEEKLY_SETS} é pouco; acima de {HIGH_WEEKLY_DIRECT_SETS} diretas é muito.{" "}
                  <Link href="/app/science/training-volume" className="font-semibold text-accent underline underline-offset-2">
                    Volume
                  </Link>
                </p>
              </details>
            ) : null}
            {guidance?.notePt ? (
              <p className="mt-2 border-t border-border pt-2 text-xs text-foreground/90">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  Esta semana ·{" "}
                </span>
                {guidance.notePt}
              </p>
            ) : null}
          </WeekReviewFrame>
        </div>
      ) : null}

      {/* The week and the program */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ThisWeekCard
          done={weeklyDone}
          target={weeklyTarget}
          strip={strip}
          streak={{
            current: streak.current,
            best: streak.best,
            remaining: streak.remaining,
            deload: guidance?.deload ?? false,
            test: guidance?.test ?? false,
            freeWeekAvailable: streak.freeWeekAvailable,
            thursdayOrLater: wall.weekday === 0 || wall.weekday >= 4,
            // Today's workout is done: the days left start tomorrow (never "falta 1" on a trained Sunday).
            daysLeft: nudgeDaysLeft(now, trainedToday),
            perWeek: hasPlan ? daysPerWeek : (profile?.daysPerWeek ?? 3),
          }}
          entry={entry ? { ...entry, alreadyCounts: rule.alreadyCounts } : null}
          programName={enrollment?.program.name ?? null}
          durationWeeks={enrollment?.program.durationWeeks ?? null}
        />
        {enrollment && weekView ? (
          <ProgramCard
            programId={enrollment.programId}
            name={enrollment.program.name}
            series={series ? { index: series.index, total: series.total } : null}
            week={weekView.kind === "entry" ? { kind: "entry" } : { kind: "week", week: weekView.week }}
            durationWeeks={enrollment.program.durationWeeks}
            guidance={guidance}
            progress={progress}
            measureLink={measure === "measure"}
          />
        ) : null}
      </div>

      {/* Today's weigh-in, when the program asks for one or the habit is on (W-083). */}
      <WeighInRow show={showWeighIn} mode={measure} glance={glance} todayNo={todayNo} />

      {/* Every day of the program, with where it stands this week */}
      {enrollment && days.length > 0 ? (
        <section className="mt-10">
          <SectionHead label="Treinos do programa" count={plural(days.length, "dia", "dias")} />
          {locked ? (
            <p className="mt-2 text-xs text-muted">Finalize ou descarte o treino em andamento para iniciar outro dia.</p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            {days.map((day) => {
              const state = states.get(day.id) ?? { kind: "idle" as const };
              const suggested = day.id === nextDay?.id && state.kind === "idle";
              const empty = day.exercises.length === 0;
              return (
                <div
                  key={day.id}
                  className="reg-frame flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
                  data-active={suggested ? "true" : undefined}
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-muted">
                    {String(day.dayIndex + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-[7rem] flex-1">
                    <p className="text-sm font-semibold leading-snug wrap-break-word">{day.name}</p>
                    <p className="text-xs text-muted">
                      {exerciseCount(day.exercises.length)}
                      {day.weekday != null && !empty ? (
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em]"> · {WEEKDAYS[day.weekday]}</span>
                      ) : null}
                      <DayStatus state={state} suggested={suggested} />
                    </p>
                  </div>
                  <DayActions
                    dayId={day.id}
                    state={state}
                    locked={locked}
                    emphasize={suggested}
                    editHref={empty ? editHref : undefined}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* The people you follow (W-139). At most one optional prompt per visit:
          the team invite gives way to the fatigue card and the weigh-in. */}
      <TeamStrip
        userId={user.id}
        now={now}
        finishedWorkouts={habit.finishedWorkouts}
        allowInvite={!fatigue && !showWeighIn}
      />

      {/* PRs */}
      {prRows.length > 0 ? (
        <section className="mt-10">
          <SectionHead label="Recordes recentes" />
          <div className="mt-4 flex flex-col divide-y divide-border border-y border-border">
            {prRows.map(({ pr, row }) => (
              <Link
                key={pr.id}
                href={`/app/exercises/${pr.exercise.slug}/history`}
                className="group flex items-center gap-4 py-3.5 hover:bg-surface-2/50"
              >
                <Lettermark code="PR" className="size-5 shrink-0 text-[9px]" />
                <div className="min-w-0 flex-1">
                  {/* Two lines: variants share a long prefix and differ at the end ("… - Pegada Aberta"). */}
                  <p className="line-clamp-2 text-sm font-semibold leading-snug wrap-break-word">{pr.exercise.namePt}</p>
                  <p className="truncate text-[11px] uppercase tracking-wider text-muted">{row.kinds.join(" · ")}</p>
                </div>
                <span className="shrink-0 font-mono text-lg font-bold tabular-nums">{row.value}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/*
        The app on the home screen, after the first workouts (decides by itself).
        Last on the page: it appears after hydration, so nothing below it can jump.
      */}
      <InstallAppCard finishedWorkouts={habit.finishedWorkouts} className="mt-10" />
    </div>
  );
}

/** A one-time mono status line (discarded, saved, restored). */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-l-accent bg-surface-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
    >
      {children}
    </p>
  );
}
