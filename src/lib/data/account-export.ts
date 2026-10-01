import "server-only";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/app-origin";
import { sharePath } from "@/lib/social/share-token";
import { deriveGroups } from "@/lib/programming/groups";
import { isTimedHold, setKind } from "@/lib/training/set-plan";
import { formatSpTime, spDayKey } from "@/lib/training/stale";
import { EQUIPMENT_LABEL, EXPERIENCE_LABEL, GOAL_LABEL, PROGRESSION_LABEL } from "@/lib/constants/program-labels";
import { toCsv, type CsvCell } from "@/lib/export/csv";

/**
 * "Exportar meus dados" (W-151): everything the account keeps, readable by a
 * person — names instead of ids, loads rounded, pt-BR words — as a
 * spreadsheet of the training log (one row per set) or as JSON. Only the
 * signed-in user's own rows are read (every query is scoped by userId). The
 * route (api/account/export) stays thin: auth, rate limit, headers.
 */

/**
 * Past this many workouts the export keeps the most recent ones (a guard for
 * memory, far beyond any real history: 5 years at 6 a week is ~1.600).
 */
const MAX_WORKOUTS = 5000;

const EXERCISE_NAME = { select: { namePt: true, slug: true } } as const;

export async function loadAccountExport(userId: string) {
  const [
    user,
    profile,
    programs,
    enrollments,
    workouts,
    personalRecords,
    bodyMetrics,
    favorites,
    exerciseNotes,
    following,
    followers,
    followRequests,
    posts,
    fgsGiven,
    blocked,
    reportsMade,
    notifications,
    reminderPreference,
    pushSubscriptions,
    reminderDeliveries,
    emails,
    dismissals,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, username: true, displayUsername: true, createdAt: true },
    }),
    prisma.profile.findUnique({ where: { userId }, omit: { id: true, userId: true } }),
    prisma.userProgram.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        name: true,
        description: true,
        status: true,
        daysPerWeek: true,
        durationWeeks: true,
        progressionStrategy: true,
        createdAt: true,
        archivedAt: true,
        sourceTemplate: { select: { namePt: true } },
        days: {
          orderBy: { dayIndex: "asc" },
          select: {
            name: true,
            focus: true,
            exercises: {
              orderBy: { sortOrder: "asc" },
              select: {
                groupKey: true,
                sets: true,
                repMin: true,
                repMax: true,
                rirTarget: true,
                restSeconds: true,
                warmupSets: true,
                loadIncrementKg: true,
                notes: true,
                exercise: EXERCISE_NAME,
              },
            },
          },
        },
      },
    }),
    prisma.programEnrollment.findMany({
      where: { userId },
      orderBy: { startedAt: "asc" },
      select: {
        status: true,
        startedAt: true,
        endedAt: true,
        currentWeek: true,
        plannedSessions: true,
        completedSessions: true,
        deloadMondays: true,
        program: { select: { name: true } },
      },
    }),
    prisma.workoutSession.findMany({
      where: { userId, status: { not: "DISCARDED" } },
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
      take: MAX_WORKOUTS,
      select: {
        name: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        durationSeconds: true,
        programWeek: true,
        notes: true,
        bodyweightKg: true,
        visibility: true,
        showDetailedLoads: true,
        caption: true,
        isDeload: true,
        sessionRpe: true,
        soreness: true,
        shortSleep: true,
        lingeringPain: true,
        highStress: true,
        checkInAt: true,
        program: { select: { name: true } },
        exerciseLogs: {
          orderBy: { sortOrder: "asc" },
          select: {
            groupKey: true,
            wasSkipped: true,
            prescribedSets: true,
            repMin: true,
            repMax: true,
            rirTarget: true,
            restSeconds: true,
            notes: true,
            exercise: EXERCISE_NAME,
            substitutedFrom: { select: { namePt: true } },
            sets: {
              orderBy: { setNumber: "asc" },
              select: {
                setNumber: true,
                setType: true,
                isExtra: true,
                weightKg: true,
                reps: true,
                rir: true,
                isCompleted: true,
                completedAt: true,
                notes: true,
              },
            },
          },
        },
      },
    }),
    prisma.exercisePersonalRecord.findMany({
      where: { userId },
      orderBy: { achievedAt: "asc" },
      select: { kind: true, value: true, weightKg: true, reps: true, achievedAt: true, exercise: EXERCISE_NAME },
    }),
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { measuredAt: "asc" },
      select: { kind: true, customLabel: true, value: true, unit: true, measuredAt: true },
    }),
    prisma.favoriteExercise.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, exercise: { select: { namePt: true } } },
    }),
    prisma.exerciseUserNote.findMany({
      where: { userId },
      orderBy: { updatedAt: "asc" },
      select: { note: true, updatedAt: true, exercise: { select: { namePt: true } } },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, following: { select: { username: true, name: true } } },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, follower: { select: { username: true, name: true } } },
    }),
    prisma.followRequest.findMany({
      where: { OR: [{ requesterId: userId }, { targetId: userId }], status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        requesterId: true,
        createdAt: true,
        requester: { select: { username: true } },
        target: { select: { username: true } },
      },
    }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      // The share token is omitted from every query by default (lib/db.ts): asked for explicitly.
      select: {
        type: true,
        caption: true,
        visibility: true,
        showDetailedLoads: true,
        fgCount: true,
        createdAt: true,
        shareToken: true,
        sharedAt: true,
        moderatedAt: true,
        session: { select: { name: true, startedAt: true } },
      },
    }),
    prisma.activityFG.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        activity: {
          select: {
            visibility: true,
            moderatedAt: true,
            user: { select: { username: true } },
            session: { select: { name: true } },
          },
        },
      },
    }),
    prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, blocked: { select: { username: true } } },
    }),
    prisma.userReport.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: "asc" },
      select: { reason: true, details: true, status: true, createdAt: true, reportedUser: { select: { username: true } } },
    }),
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "asc" },
      select: { type: true, createdAt: true, readAt: true, actor: { select: { username: true } } },
    }),
    prisma.reminderPreference.findUnique({ where: { userId }, omit: { userId: true } }),
    // Devices only: the endpoint and keys are the subscription's credentials, not the user's data.
    prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { userAgent: true, createdAt: true, lastSuccessAt: true },
    }),
    prisma.reminderDelivery.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        kind: true,
        channel: true,
        status: true,
        skipReason: true,
        sentAt: true,
        clickedAt: true,
        engagedAt: true,
        ignoredAt: true,
        createdAt: true,
      },
    }),
    // What was sent to the account, never the bodies (a login code stays out of any file).
    prisma.emailMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { kind: true, subject: true, status: true, createdAt: true },
    }),
    prisma.userDismissal.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { key: true, createdAt: true } }),
  ]);

  return {
    user,
    profile,
    programs,
    enrollments,
    // Oldest first, as a log reads.
    workouts: workouts.reverse(),
    personalRecords,
    bodyMetrics,
    favorites,
    exerciseNotes,
    following,
    followers,
    followRequests: followRequests.map((r) => ({
      sent: r.requesterId === userId,
      from: r.requester.username,
      to: r.target.username,
      createdAt: r.createdAt,
    })),
    posts,
    fgsGiven,
    blocked,
    reportsMade,
    notifications,
    reminderPreference,
    pushSubscriptions,
    reminderDeliveries,
    emails,
    dismissals,
  };
}

export type AccountExportData = Awaited<ReturnType<typeof loadAccountExport>>;
type ExportWorkout = AccountExportData["workouts"][number];

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const SET_TYPE_LABEL: Record<string, string> = {
  WARMUP: "Aquecimento",
  WORKING: "Válida",
  DROP: "Drop set",
  FAILURE: "Até a falha",
};
const VISIBILITY_LABEL: Record<string, string> = { PRIVATE: "Privado", FOLLOWERS: "Seguidores", PUBLIC: "Público" };
const WORKOUT_STATUS_LABEL: Record<string, string> = { COMPLETED: "Concluído", IN_PROGRESS: "Em andamento", DISCARDED: "Descartado" };
const PROGRAM_STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", ACTIVE: "Ativo", ARCHIVED: "Arquivado" };
const ENROLLMENT_STATUS_LABEL: Record<string, string> = { ACTIVE: "Em andamento", COMPLETED: "Concluído", ABANDONED: "Interrompido" };
const PR_KIND_LABEL: Record<string, string> = {
  MAX_WEIGHT: "Carga máxima",
  MAX_REPS_AT_WEIGHT: "Mais repetições na carga",
  ESTIMATED_1RM: "1RM estimado",
  SESSION_VOLUME: "Volume do treino",
};
const BODY_KIND_LABEL: Record<string, string> = {
  BODYWEIGHT: "Peso corporal",
  WAIST: "Cintura",
  CHEST: "Peito",
  HIPS: "Quadril",
  ARM: "Braço",
  THIGH: "Coxa",
  CALF: "Panturrilha",
  CUSTOM: "Outra medida",
};
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  WORKOUT: "Treino",
  PERSONAL_RECORD: "Recorde",
  MILESTONE: "Marco",
  PROGRAM_COMPLETED: "Programa concluído",
};
const NOTIFICATION_LABEL: Record<string, string> = {
  FG_RECEIVED: "FG recebido",
  NEW_FOLLOWER: "Novo seguidor",
  FOLLOW_REQUEST: "Pedido para seguir",
  FOLLOW_ACCEPTED: "Pedido aceito",
  PERSONAL_RECORD: "Recorde pessoal",
  PROGRAM_WEEK_COMPLETE: "Semana completa",
  PROGRAM_COMPLETED: "Programa concluído",
  WORKOUT_MILESTONE: "Marco de treinos",
};
const REPORT_REASON_LABEL: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Assédio",
  INAPPROPRIATE_CONTENT: "Conteúdo impróprio",
  FAKE_DATA: "Dados falsos",
  OTHER: "Outro",
};
const REPORT_STATUS_LABEL: Record<string, string> = {
  OPEN: "Em análise",
  REVIEWED: "Analisada",
  ACTIONED: "Resolvida",
  DISMISSED: "Arquivada",
};
const REMINDER_KIND_LABEL: Record<string, string> = {
  WEEKLY_DIGEST: "Resumo semanal",
  TRAINING_DAY: "Dia de treino",
  OPEN_WORKOUT: "Treino aberto",
};
const REMINDER_STATUS_LABEL: Record<string, string> = { PENDING: "Pendente", SENT: "Enviado", FAILED: "Falhou", SKIPPED: "Não enviado" };
const EMAIL_KIND_LABEL: Record<string, string> = {
  LOGIN_CODE: "Código de acesso",
  WEEKLY_DIGEST: "Resumo semanal",
  ADMIN_REPORT: "Denúncias (admin)",
};

const label = (map: Record<string, string>, value: string | null | undefined) => (value ? (map[value] ?? value) : null);
/** Two decimals at most (44.62524042425695 → 44.63). */
const round2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** A São Paulo Monday day number (ProgramEnrollment.deloadMondays) as "YYYY-MM-DD". */
function dayNoKey(dayNo: number): string {
  return new Date(dayNo * 86_400_000).toISOString().slice(0, 10);
}

/** A set row nobody filled in or ✓'d: the workout opened it, nothing more. */
function isUntouchedSet(s: { isCompleted: boolean; weightKg: number | null; reps: number | null; rir: number | null; notes: string | null }) {
  return !s.isCompleted && s.weightKg === null && s.reps === null && s.rir === null && !s.notes;
}

/**
 * Each set's number as the workout screen and the summary name it — counted
 * within its kind: "Aquecimento 1", "Série 1", "Série extra 1" — so the
 * first working set after two warm-ups is 1, not its row number 3. `sets`
 * in setNumber order, untouched rows included (they hold their place).
 */
function setOrdinals(sets: readonly { setType: "WARMUP" | "WORKING" | "DROP" | "FAILURE"; isExtra: boolean }[]): number[] {
  const seen = { WARMUP: 0, PRESCRIBED: 0, EXTRA: 0 };
  return sets.map((s) => ++seen[setKind(s)]);
}

/** "A1" labels of a workout's or a day's exercises (W-104): null when not in a group. */
function groupLabels(items: readonly { groupKey: string | null }[]): (string | null)[] {
  return deriveGroups(items).map((slot) => slot?.label ?? null);
}

// ---------------------------------------------------------------------------
// CSV: the training log, one row per completed set
// ---------------------------------------------------------------------------

export const TREINOS_CSV_HEADER = [
  "Data",
  "Início",
  "Treino",
  "Programa",
  "Semana",
  "Ordem",
  "Grupo",
  "Exercício",
  "No lugar de",
  "Série",
  "Tipo",
  "Extra",
  "Carga (kg)",
  "Reps",
  "Segundos",
  "RIR",
  "Nota da série",
] as const;

const finishedFirst = (a: ExportWorkout, b: ExportWorkout) =>
  (a.finishedAt?.getTime() ?? 0) - (b.finishedAt?.getTime() ?? 0) || a.startedAt.getTime() - b.startedAt.getTime();

/**
 * Every completed set of every finished workout, in the order they were
 * done: by the workout's finish, then the exercise's place, then the set.
 * A hold's value goes under "Segundos" (Reps empty); loads keep two decimals
 * with a comma ("44,63").
 */
export function toTreinosCsv(data: Pick<AccountExportData, "workouts">): string {
  const rows: CsvCell[][] = [];
  const finished = data.workouts.filter((w) => w.status === "COMPLETED" && w.finishedAt).sort(finishedFirst);
  for (const w of finished) {
    const groups = groupLabels(w.exerciseLogs);
    w.exerciseLogs.forEach((log, i) => {
      const timed = isTimedHold({ slug: log.exercise.slug, notes: log.notes });
      const numbers = setOrdinals(log.sets);
      log.sets.forEach((s, j) => {
        if (!s.isCompleted) return;
        rows.push([
          spDayKey(w.finishedAt!),
          formatSpTime(w.startedAt),
          w.name,
          w.program?.name ?? "",
          w.programWeek ?? "",
          i + 1,
          groups[i] ?? "",
          log.exercise.namePt,
          log.substitutedFrom?.namePt ?? "",
          numbers[j],
          label(SET_TYPE_LABEL, s.setType),
          s.isExtra ? "sim" : "não",
          s.weightKg,
          timed ? "" : s.reps,
          timed ? s.reps : "",
          s.rir,
          s.notes ?? "",
        ]);
      });
    });
  }
  return toCsv(TREINOS_CSV_HEADER, rows);
}

// ---------------------------------------------------------------------------
// JSON: everything, readable
// ---------------------------------------------------------------------------

export function toExportJson(data: AccountExportData, now: Date = new Date()) {
  const p = data.profile;
  const reminders = data.reminderPreference;
  return {
    format: "fgpower-export",
    version: 2,
    exportedAt: now.toISOString(),
    account: data.user
      ? {
          name: data.user.name,
          email: data.user.email,
          username: data.user.displayUsername ?? data.user.username,
          createdAt: iso(data.user.createdAt),
        }
      : null,
    profile: p
      ? {
          displayName: p.displayName,
          bio: p.bio,
          location: p.location,
          goal: label(GOAL_LABEL, p.goal),
          experience: label(EXPERIENCE_LABEL, p.experience),
          equipmentAccess: label(EQUIPMENT_LABEL, p.equipmentAccess),
          daysPerWeek: p.daysPerWeek,
          sessionMinutes: p.sessionMinutes,
          preferredDays: p.preferredDays.map((d) => WEEKDAY_NAMES[d] ?? d),
          doesEndurance: p.doesEndurance,
          enduranceNotes: p.enduranceNotes,
          limitations: p.limitations,
          loadIncrementKg: p.loadIncrementKg,
          restTimerSound: p.restTimerSound,
          hapticsEnabled: p.hapticsEnabled,
          isPublicAccount: p.isPublicAccount,
          defaultWorkoutVisibility: label(VISIBILITY_LABEL, p.defaultWorkoutVisibility),
          showLoadsPublicly: p.showLoadsPublicly,
          showCurrentProgram: p.showCurrentProgram,
          discoverable: p.discoverable,
          onboardingCompletedAt: iso(p.onboardingCompletedAt),
          createdAt: iso(p.createdAt),
          updatedAt: iso(p.updatedAt),
        }
      : null,
    programs: data.programs.map((prog) => ({
      name: prog.name,
      description: prog.description,
      status: label(PROGRAM_STATUS_LABEL, prog.status),
      basedOn: prog.sourceTemplate?.namePt ?? null,
      daysPerWeek: prog.daysPerWeek,
      durationWeeks: prog.durationWeeks,
      progression: label(PROGRESSION_LABEL, prog.progressionStrategy),
      createdAt: iso(prog.createdAt),
      archivedAt: iso(prog.archivedAt),
      days: prog.days.map((day) => {
        const groups = groupLabels(day.exercises);
        return {
          name: day.name,
          focus: day.focus,
          exercises: day.exercises.map((ex, i) => ({
            exercise: ex.exercise.namePt,
            slug: ex.exercise.slug,
            group: groups[i],
            sets: ex.sets,
            repMin: ex.repMin,
            repMax: ex.repMax,
            rirTarget: ex.rirTarget,
            restSeconds: ex.restSeconds,
            warmupSets: ex.warmupSets,
            loadIncrementKg: ex.loadIncrementKg,
            notes: ex.notes,
          })),
        };
      }),
    })),
    programRuns: data.enrollments.map((e) => ({
      program: e.program.name,
      status: label(ENROLLMENT_STATUS_LABEL, e.status),
      startedAt: iso(e.startedAt),
      endedAt: iso(e.endedAt),
      currentWeek: e.currentWeek,
      plannedWorkouts: e.plannedSessions,
      completedWorkouts: e.completedSessions,
      deloadWeeks: e.deloadMondays.map(dayNoKey),
    })),
    workouts: data.workouts.map((w) => {
      const groups = groupLabels(w.exerciseLogs);
      return {
        name: w.name,
        program: w.program?.name ?? null,
        programWeek: w.programWeek,
        status: label(WORKOUT_STATUS_LABEL, w.status),
        startedAt: iso(w.startedAt),
        finishedAt: iso(w.finishedAt),
        durationSeconds: w.durationSeconds,
        deload: w.isDeload,
        notes: w.notes,
        bodyweightKg: round2(w.bodyweightKg),
        visibility: label(VISIBILITY_LABEL, w.visibility),
        showDetailedLoads: w.showDetailedLoads,
        caption: w.caption,
        checkIn: w.checkInAt
          ? {
              answeredAt: iso(w.checkInAt),
              sessionRpe: w.sessionRpe,
              soreness: w.soreness,
              shortSleep: w.shortSleep,
              lingeringPain: w.lingeringPain,
              highStress: w.highStress,
            }
          : null,
        exercises: w.exerciseLogs.map((log, i) => {
          const timed = isTimedHold({ slug: log.exercise.slug, notes: log.notes });
          const numbers = setOrdinals(log.sets);
          return {
            exercise: log.exercise.namePt,
            slug: log.exercise.slug,
            group: groups[i],
            substitutedFrom: log.substitutedFrom?.namePt ?? null,
            skipped: log.wasSkipped,
            timed,
            prescription: {
              sets: log.prescribedSets,
              repMin: log.repMin,
              repMax: log.repMax,
              rirTarget: log.rirTarget,
              restSeconds: log.restSeconds,
            },
            notes: log.notes,
            // Rows opened with the workout and never touched (a warm-up skipped, a set not done) say
            // nothing. Numbered as the app names them: within their kind (type/extra tell which).
            sets: log.sets.flatMap((s, j) => (isUntouchedSet(s) ? [] : [{ s, number: numbers[j] }])).map(({ s, number }) => ({
              number,
              type: label(SET_TYPE_LABEL, s.setType),
              extra: s.isExtra,
              weightKg: round2(s.weightKg),
              reps: timed ? null : s.reps,
              seconds: timed ? s.reps : null,
              rir: round2(s.rir),
              completed: s.isCompleted,
              completedAt: iso(s.completedAt),
              notes: s.notes,
            })),
          };
        }),
      };
    }),
    personalRecords: data.personalRecords.map((r) => ({
      exercise: r.exercise.namePt,
      kind: label(PR_KIND_LABEL, r.kind),
      value: round2(r.value),
      weightKg: round2(r.weightKg),
      reps: r.reps,
      achievedAt: iso(r.achievedAt),
    })),
    bodyMetrics: data.bodyMetrics.map((m) => ({
      kind: label(BODY_KIND_LABEL, m.kind),
      customLabel: m.customLabel,
      value: round2(m.value),
      unit: m.unit,
      measuredAt: iso(m.measuredAt),
    })),
    favoriteExercises: data.favorites.map((f) => f.exercise.namePt),
    exerciseNotes: data.exerciseNotes.map((n) => ({ exercise: n.exercise.namePt, note: n.note, updatedAt: iso(n.updatedAt) })),
    social: {
      following: data.following.map((f) => ({ username: f.following.username, name: f.following.name, since: iso(f.createdAt) })),
      followers: data.followers.map((f) => ({ username: f.follower.username, name: f.follower.name, since: iso(f.createdAt) })),
      pendingRequests: data.followRequests.map((r) => ({
        direction: r.sent ? "enviado" : "recebido",
        from: r.from,
        to: r.to,
        createdAt: iso(r.createdAt),
      })),
      posts: data.posts.map((a) => ({
        type: label(ACTIVITY_TYPE_LABEL, a.type),
        workout: a.session?.name ?? null,
        workoutStartedAt: iso(a.session?.startedAt),
        caption: a.caption,
        visibility: label(VISIBILITY_LABEL, a.visibility),
        showDetailedLoads: a.showDetailedLoads,
        fgCount: a.fgCount,
        createdAt: iso(a.createdAt),
        shareLink: a.shareToken ? appUrl(sharePath(a.shareToken)) : null,
        sharedAt: iso(a.sharedAt),
        hiddenByModeration: a.moderatedAt !== null,
      })),
      fgsGiven: data.fgsGiven.map((g) => ({
        to: g.activity.user.username,
        // Someone else's workout: named only while its owner still shows it (not made private
        // since, not hidden by moderation).
        workout: g.activity.visibility !== "PRIVATE" && g.activity.moderatedAt === null ? (g.activity.session?.name ?? null) : null,
        at: iso(g.createdAt),
      })),
      blocked: data.blocked.map((b) => ({ username: b.blocked.username, since: iso(b.createdAt) })),
      reportsMade: data.reportsMade.map((r) => ({
        about: r.reportedUser?.username ?? null,
        reason: label(REPORT_REASON_LABEL, r.reason),
        details: r.details,
        status: label(REPORT_STATUS_LABEL, r.status),
        createdAt: iso(r.createdAt),
      })),
      notifications: data.notifications.map((n) => ({
        type: label(NOTIFICATION_LABEL, n.type),
        from: n.actor?.username ?? null,
        createdAt: iso(n.createdAt),
        readAt: iso(n.readAt),
      })),
    },
    reminders: {
      settings: reminders
        ? {
            pushHour: reminders.pushHour,
            emailDigest: reminders.emailDigest,
            emailDigestOptInAt: iso(reminders.emailDigestOptInAt),
            emailUnsubscribedAt: iso(reminders.emailUnsubscribedAt),
            pausedAt: iso(reminders.pausedAt),
            resumedAt: iso(reminders.resumedAt),
            askDismissedAt: iso(reminders.askDismissedAt),
            createdAt: iso(reminders.createdAt),
          }
        : null,
      pushDevices: data.pushSubscriptions.map((s) => ({
        device: s.userAgent,
        since: iso(s.createdAt),
        lastDeliveredAt: iso(s.lastSuccessAt),
      })),
      sent: data.reminderDeliveries.map((d) => ({
        kind: label(REMINDER_KIND_LABEL, d.kind),
        channel: d.channel === "PUSH" ? "Notificação" : "E-mail",
        status: label(REMINDER_STATUS_LABEL, d.status),
        skipReason: d.skipReason,
        sentAt: iso(d.sentAt),
        clickedAt: iso(d.clickedAt),
        createdAt: iso(d.createdAt),
      })),
      emails: data.emails.map((m) => ({
        kind: label(EMAIL_KIND_LABEL, m.kind),
        subject: m.subject,
        status: m.status,
        at: iso(m.createdAt),
      })),
    },
    dismissedPrompts: data.dismissals.map((d) => ({ key: d.key, at: iso(d.createdAt) })),
  };
}

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "fgpower-treinos-2026-09-28.csv" / "fgpower-dados-2026-09-28.json" (São Paulo day). */
export function exportFilename(format: "csv" | "json", now: Date = new Date()): string {
  return format === "csv" ? `fgpower-treinos-${spDayKey(now)}.csv` : `fgpower-dados-${spDayKey(now)}.json`;
}
