import { formatNumber, plural, pluralWord } from "@/lib/utils/format";

/**
 * The words of the reminder pushes (W-017 §7). Pure. A push shows on a lock
 * screen: never a load, a body measurement or anything from a note.
 */

const MAX_TITLE = 60;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export interface TrainingDayFacts {
  /** Today's program day ("Segunda — Superior (pesado)"). */
  dayName: string;
  exerciseCount: number;
  /** Days since the last finished workout (null: never trained). */
  daysSinceLast: number | null;
  /** From this many days away, the push welcomes the user back (Today's rule). */
  welcomeBackAfterDays: number;
  streakCurrent: number;
  /** Workouts still needed for this week to count. */
  remaining: number;
  /** Planned training days left this week, today included. */
  plannedLeft: number;
  program: { name: string; week: number | null; weeks: number | null; entry: boolean; rir: number | null };
}

export function trainingDayPush(f: TrainingDayFacts): { title: string; body: string } {
  const title = clip(`Hoje: ${f.dayName}`, MAX_TITLE);
  if (f.daysSinceLast != null && f.daysSinceLast >= f.welcomeBackAfterDays) {
    return {
      title,
      body: `${f.daysSinceLast} dias desde o último treino. Volte com ~90% das cargas — a força volta rápido.`,
    };
  }
  if (f.streakCurrent >= 2 && f.remaining > 0 && f.remaining >= f.plannedLeft) {
    return {
      title,
      body: `${pluralWord(f.remaining, "Falta", "Faltam")} ${plural(f.remaining, "treino", "treinos")} para a semana contar · ${f.streakCurrent} semanas seguidas no alvo.`,
    };
  }
  const exercises = plural(f.exerciseCount, "exercício", "exercícios");
  const parts = [f.program.name];
  if (f.program.entry) parts.push("semana de entrada");
  else if (f.program.week != null) {
    parts.push(f.program.weeks ? `Semana ${f.program.week} de ${f.program.weeks}` : `Semana ${f.program.week}`);
    if (f.program.rir != null) parts.push(`RIR alvo ${formatNumber(f.program.rir, 1)}`);
  }
  parts.push(exercises);
  return { title, body: parts.join(" · ") };
}

export function openWorkoutPush(p: { name: string; hoursOpen: number; registered: number }): { title: string; body: string } {
  const hours = Math.max(1, Math.floor(p.hoursOpen));
  const sets = p.registered > 0 ? ` com ${plural(p.registered, "série registrada", "séries registradas")}` : "";
  return {
    title: clip(`Treino aberto: ${p.name}`, MAX_TITLE),
    body: `Aberto há ${hours} h${sets}. Toque para finalizar ou descartar.`,
  };
}
