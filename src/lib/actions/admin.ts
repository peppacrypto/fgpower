"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, ReportStatus } from "@/generated/prisma/client";
import { requireAdminOrThrow } from "@/lib/auth/require-user";
import { isAdminUser } from "@/lib/auth/roles";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import type { ExerciseContent } from "@/lib/exercises/content";
import { REPORT_REASON_LABEL, goneWorkoutOf, isReportReason } from "@/lib/social/notification-reports-core";
import type { ActionResult } from "./result";

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export interface ExerciseAdminUpdate {
  namePt: string;
  nameEn: string;
  isCurated: boolean;
  isPublished: boolean;
  setupPt: string;
  breathingPt: string;
  coachingCuesPt: string; // newline-separated
  commonMistakesPt: string; // newline-separated
  rangeOfMotionPt: string;
  whyThisExerciseExistsPt: string;
}

export async function updateExerciseAdmin(exerciseId: string, input: ExerciseAdminUpdate) {
  await requireAdminOrThrow();

  const contentPt: ExerciseContent | null = input.setupPt.trim()
    ? {
        setup: input.setupPt.trim(),
        breathing: input.breathingPt.trim(),
        coachingCues: linesToArray(input.coachingCuesPt),
        commonMistakes: linesToArray(input.commonMistakesPt),
        rangeOfMotion: input.rangeOfMotionPt.trim(),
        whyThisExerciseExists: input.whyThisExerciseExistsPt.trim(),
      }
    : null;

  await prisma.exercise.update({
    where: { id: exerciseId },
    data: {
      namePt: input.namePt,
      nameEn: input.nameEn,
      isCurated: input.isCurated,
      isPublished: input.isPublished,
      contentPt: contentPt as never,
    },
  });

  revalidatePath("/admin/exercises");
  revalidatePath(`/admin/exercises/${exerciseId}/edit`);
}

export async function linkExerciseEvidence(exerciseId: string, sourceKey: string, notePt: string) {
  await requireAdminOrThrow();
  const source = await prisma.evidenceSource.findUnique({ where: { key: sourceKey.trim() } });
  if (!source) throw new Error("EVIDENCE_SOURCE_NOT_FOUND");

  await prisma.exerciseEvidence.upsert({
    where: { exerciseId_sourceId: { exerciseId, sourceId: source.id } },
    create: { exerciseId, sourceId: source.id, notePt: notePt || null },
    update: { notePt: notePt || null },
  });
  revalidatePath(`/admin/exercises/${exerciseId}/edit`);
}

export async function unlinkExerciseEvidence(exerciseId: string, sourceId: string) {
  await requireAdminOrThrow();
  await prisma.exerciseEvidence.delete({ where: { exerciseId_sourceId: { exerciseId, sourceId } } });
  revalidatePath(`/admin/exercises/${exerciseId}/edit`);
}

// ---------------------------------------------------------------------------
// Report moderation (decision 15, W-141 D)
// ---------------------------------------------------------------------------

/**
 * What an admin does with a report:
 * - REVIEW: looked at, nothing to do (REVIEWED);
 * - DISMISS: not a problem (DISMISSED);
 * - HIDE: the workout goes private for good — activity and workout PRIVATE,
 *   its share link revoked, `moderatedAt` set so the owner can't publish or
 *   share it again (ACTIONED);
 * - DELETE: the post is deleted; the workout stays in its owner's history,
 *   private (ACTIONED);
 * - BAN: the account is banned — its sessions end, the notifications it sent
 *   and its push subscriptions go, and it disappears for everyone else
 *   (ACTIONED). Never yourself or another admin.
 * Every other open report about the same workout (or, for a ban, the same
 * person) is resolved with it.
 */
export type ModerationAction = "REVIEW" | "DISMISS" | "HIDE" | "DELETE" | "BAN";
const MODERATION_ACTIONS: readonly ModerationAction[] = ["REVIEW", "DISMISS", "HIDE", "DELETE", "BAN"];

const NOTE_MAX = 500;

type AdminGate = { ok: true; admin: { id: string } } | { ok: false; error: string };

/**
 * requireAdminOrThrow as a result: an expired session says so (D-L); anyone
 * else is refused; a failure to check (the database down) is a plain retry,
 * not "sign in again".
 */
async function adminGate(): Promise<AdminGate> {
  try {
    const admin = await requireAdminOrThrow();
    return { ok: true, admin };
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "FORBIDDEN") return { ok: false, error: "Você não tem acesso a isso." };
    if (code === "UNAUTHORIZED") return { ok: false, error: SESSION_EXPIRED_ERROR };
    console.error("admin check failed", err);
    return { ok: false, error: "Não foi possível concluir agora. Tente de novo." };
  }
}

/** The workout's own visibility follows its post, keeping its save time (the 24 h correction window runs from it). */
async function makeSessionPrivate(tx: Prisma.TransactionClient, sessionId: string | null) {
  if (!sessionId) return;
  const session = await tx.workoutSession.findUnique({ where: { id: sessionId }, select: { updatedAt: true } });
  if (!session) return;
  await tx.workoutSession.update({ where: { id: sessionId }, data: { visibility: "PRIVATE", updatedAt: session.updatedAt } });
}

/**
 * The other open reports a decision settles with this one: about the same
 * workout, or — for a ban — anything about the person. A report with no live
 * post (a person report, or one whose post the owner deleted since) takes
 * only reports about the same thing: never the other kind, and never other
 * reports that merely lost both links (old workout reports kept no person).
 */
async function openSiblings(
  report: { id: string; activityId: string | null; reportedUserId: string | null; snapshot: unknown },
  bannedUserId: string | null,
): Promise<string[]> {
  if (bannedUserId) {
    const rows = await prisma.userReport.findMany({
      where: { status: "OPEN", id: { not: report.id }, OR: [{ reportedUserId: bannedUserId }, { activity: { userId: bannedUserId } }] },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  if (report.activityId) {
    const rows = await prisma.userReport.findMany({
      where: { status: "OPEN", id: { not: report.id }, activityId: report.activityId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  if (!report.reportedUserId) return [];
  const gone = goneWorkoutOf(report.snapshot);
  const rows = await prisma.userReport.findMany({
    where: { status: "OPEN", id: { not: report.id }, reportedUserId: report.reportedUserId, activityId: null },
    select: { id: true, snapshot: true },
  });
  return rows.filter((r) => goneWorkoutOf(r.snapshot) === gone).map((r) => r.id);
}

export async function moderateReport(
  reportId: string,
  action: ModerationAction,
  note: string = "",
): Promise<ActionResult<{ status: ReportStatus; resolved: number }>> {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  if (!MODERATION_ACTIONS.includes(action)) return { ok: false, error: "Ação desconhecida." };
  if (typeof reportId !== "string" || !reportId) return { ok: false, error: "Esta denúncia não existe mais." };

  const report = await prisma.userReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      reason: true,
      activityId: true,
      reportedUserId: true,
      snapshot: true,
      activity: { select: { id: true, userId: true, sessionId: true, summary: true } },
    },
  });
  if (!report) return { ok: false, error: "Esta denúncia não existe mais." };
  if (report.status !== "OPEN") return { ok: false, error: "Esta denúncia já foi resolvida." };

  const now = new Date();
  const cleanNote = typeof note === "string" ? note.trim().slice(0, NOTE_MAX) || null : null;
  const targetUserId = report.reportedUserId ?? report.activity?.userId ?? null;
  const activity = report.activity;
  if ((action === "HIDE" || action === "DELETE") && !activity) {
    // No activity left: a person report, or a workout report whose post was deleted since.
    const aboutWorkout = (report.snapshot as { kind?: unknown } | null)?.kind === "activity";
    return { ok: false, error: aboutWorkout ? "A publicação já foi excluída." : "Esta denúncia não é sobre um treino." };
  }

  // The open reports this decision settles — read before a delete empties their activityId.
  const ids = [report.id, ...(await openSiblings(report, action === "BAN" ? targetUserId : null))];

  let status: ReportStatus;
  let resolutionNote = cleanNote;
  switch (action) {
    case "REVIEW":
      status = "REVIEWED";
      break;
    case "DISMISS":
      status = "DISMISSED";
      break;
    case "HIDE": {
      await prisma.$transaction(async (tx) => {
        await tx.activity.update({
          where: { id: activity!.id },
          data: { visibility: "PRIVATE", shareToken: null, sharedAt: null, moderatedAt: now },
        });
        await makeSessionPrivate(tx, activity!.sessionId);
      });
      status = "ACTIONED";
      resolutionNote = cleanNote ?? "Treino ocultado.";
      break;
    }
    case "DELETE": {
      const summary = (activity!.summary ?? {}) as { workoutName?: unknown };
      const workoutName = typeof summary.workoutName === "string" ? summary.workoutName : "treino";
      await prisma.$transaction(async (tx) => {
        // The post's row first, then its workout's: the order every writer of both takes (the owner's
        // share in lib/social/publish.ts, activity-owner.ts, HIDE above). The other way round, a share
        // landing between them deadlocked with this (admin.lock-order.integration.test.ts).
        await tx.activity.delete({ where: { id: activity!.id } });
        await makeSessionPrivate(tx, activity!.sessionId);
      });
      status = "ACTIONED";
      resolutionNote = `Publicação excluída: ${workoutName}${cleanNote ? ` — ${cleanNote}` : ""}`;
      break;
    }
    case "BAN": {
      if (!targetUserId) return { ok: false, error: "Não há conta para banir nesta denúncia." };
      if (targetUserId === gate.admin.id) return { ok: false, error: "Você não pode banir a si mesmo." };
      const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true, email: true } });
      if (!target) return { ok: false, error: "Esta conta não existe mais." };
      if (isAdminUser(target)) return { ok: false, error: "Não é possível banir outro admin." };
      const reason = isReportReason(report.reason) ? REPORT_REASON_LABEL[report.reason] : report.reason;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: targetUserId },
          data: { banned: true, banReason: cleanNote ?? `Denúncia: ${reason}`, banExpires: null },
        }),
        prisma.session.deleteMany({ where: { userId: targetUserId } }),
        prisma.notification.deleteMany({ where: { actorId: targetUserId } }),
        prisma.pushSubscription.deleteMany({ where: { userId: targetUserId } }),
      ]);
      status = "ACTIONED";
      resolutionNote = cleanNote ?? `Conta banida (${reason}).`;
      break;
    }
  }

  const { count } = await prisma.userReport.updateMany({
    where: { id: { in: ids }, status: "OPEN" },
    data: { status, resolutionNote, resolvedById: gate.admin.id, resolvedAt: now },
  });
  // No revalidation: the panel moves on to /admin/reports?resolvida=… itself (a
  // revalidation would re-render this page first, dropping the card mid-tap).
  return { ok: true, status, resolved: count };
}

/** Lifts a ban (from "Resolvidas"): the account and everything it posted come back; sessions don't. */
export async function unbanUser(userId: string): Promise<ActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  if (typeof userId !== "string" || !userId) return { ok: false, error: "Esta conta não existe mais." };
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { banned: false, banReason: null, banExpires: null },
  });
  if (count === 0) return { ok: false, error: "Esta conta não existe mais." };
  return { ok: true };
}
