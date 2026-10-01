import { plural } from "@/lib/utils/format";

/**
 * What a notification says, in one line (W-042, W-043, W-138). Pure and
 * client-safe: the notifications page renders it, and a follow request's
 * line changes on the spot after Aceitar / Recusar.
 */

export type RequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface NotificationTextInput {
  type: string;
  /** The row's stored payload (records, week, program, milestone). */
  data?: unknown;
  /** Who did it, newest first, one entry per person (an FG group lists several). */
  actorNames?: string[];
  /** FG rows: the workout's name ("Push A"), when known. */
  workoutName?: string | null;
  /** FOLLOW_REQUEST rows: where the request stands now. */
  requestStatus?: RequestStatus | null;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "Ana", "Ana e Bruno", "Ana, Bruno e mais 3". */
export function namesText(names: string[]): string {
  const list = names.length > 0 ? names : ["Alguém"];
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} e ${list[1]}`;
  return `${list[0]}, ${list[1]} e mais ${list.length - 2}`;
}

function fgText(names: string[], workoutName: string | null | undefined) {
  const who = namesText(names);
  const verb = names.length > 1 ? "deram" : "deu";
  const name = str(workoutName);
  return `${who} ${verb} FG no seu treino${name ? ` ${name}` : ""}`;
}

/** "Novo recorde em Supino", "2 recordes: Supino e Remada", "4 recordes: Supino, Remada e mais 2". */
function recordsText(data: unknown) {
  const d = obj(data);
  const names = Array.isArray(d.exercises) ? d.exercises.map(str).filter((n): n is string => n !== null) : [];
  const count = Math.max(num(d.count) ?? 0, names.length);
  if (count === 0 || names.length === 0) return "Você bateu um novo recorde";
  if (count === 1) return `Novo recorde em ${names[0]}`;
  const list =
    count === 2 && names.length >= 2
      ? `${names[0]} e ${names[1]}`
      : names.length >= 2
        ? `${names[0]}, ${names[1]} e mais ${count - 2}`
        : `${names[0]} e mais ${count - 1}`;
  return `${count} recordes: ${list}`;
}

/** "Semana 3 de GD 1 completa · 4 de 4 treinos · 5 semanas seguidas". */
function weekText(data: unknown) {
  const d = obj(data);
  const program = str(d.programName);
  const week = num(d.programWeek);
  const done = num(d.done);
  const target = num(d.target);
  const streak = num(d.streak) ?? 0;
  const parts: string[] = [];
  if (d.deload === true) {
    parts.push("Semana de deload feita");
    if (program) parts.push(program);
  } else {
    if (program && week != null && week >= 1) parts.push(`Semana ${week} de ${program} completa`);
    else if (program && week === 0) parts.push(`Semana de entrada de ${program} completa`);
    else if (program) parts.push(`Semana de ${program} completa`);
    else parts.push("Semana completa");
    if (done != null && target != null && target > 0) {
      parts.push(done > target ? plural(done, "treino", "treinos") : `${done} de ${plural(target, "treino", "treinos")}`);
    }
  }
  if (streak >= 2) parts.push(`${streak} semanas seguidas`);
  return parts.join(" · ");
}

export function notificationText(n: NotificationTextInput): string {
  const names = n.actorNames ?? [];
  const actor = names[0] ?? "Alguém";
  switch (n.type) {
    case "FG_RECEIVED":
      return fgText(names, n.workoutName);
    case "NEW_FOLLOWER":
      return `${actor} começou a seguir você`;
    case "FOLLOW_REQUEST":
      if (n.requestStatus === "ACCEPTED") return `${actor} agora segue você`;
      if (n.requestStatus === "DECLINED") return `Você recusou o pedido de ${actor}`;
      return `${actor} pediu para seguir você`;
    case "FOLLOW_ACCEPTED":
      return `${actor} aceitou sua solicitação`;
    case "PERSONAL_RECORD":
      return recordsText(n.data);
    case "PROGRAM_WEEK_COMPLETE":
      return n.data ? weekText(n.data) : "Você completou uma semana do programa";
    case "PROGRAM_COMPLETED": {
      const program = str(obj(n.data).programName);
      return program ? `Você concluiu ${program}` : "Você concluiu um programa";
    }
    case "WORKOUT_MILESTONE": {
      const count = num(obj(n.data).count);
      return count ? `Dossiê nº ${count} · ${plural(count, "treino registrado", "treinos registrados")}` : "Novo marco de treinos";
    }
    default:
      return "Nova notificação";
  }
}
