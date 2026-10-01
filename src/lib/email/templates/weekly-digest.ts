import { formatDayTag } from "@/lib/training/day-rotation";
import { formatNumber, plural, pluralWord } from "@/lib/utils/format";
import { renderEmail, type EmailBlock } from "../layout";

/**
 * The weekly e-mail digest (W-017 §6, opt-in): how last week went and what
 * this one holds, sent on the user's first training day of the week at
 * 07:00. Pure: lib/reminders/digest gathers the facts. Every string is
 * escaped by the layout.
 */

export interface DigestData {
  firstName: string | null;
  /** São Paulo day number it goes out on. */
  todayNo: number;
  lastWeek: { done: number; target: number; met: boolean; deload: boolean } | null;
  streak: { current: number; best: number };
  /** Exercises with a record last week. */
  records: string[];
  /** Top muscles by fractional working sets last week. */
  muscles: { name: string; sets: number }[];
  program: {
    name: string;
    /** Program week (null in the entry week). */
    week: number | null;
    weeks: number | null;
    entry: boolean;
    test: boolean;
    rir: number | null;
    note: string | null;
    /** "SEG · QUA · SEX" (null without a schedule). */
    days: string | null;
    /** Today's workout, when today is a training day. */
    today: { name: string; exerciseCount: number } | null;
  } | null;
  /** A block finished recently, with nothing active. */
  block: { name: string; nextName: string | null } | null;
  urls: { cta: string; unsubscribe: string; preferences: string };
}

const MAX_SUBJECT = 78;
const MAX_NOTE = 200;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function digestSubject(d: DigestData): string {
  const p = d.program;
  if (p) {
    if (p.test) return clip(`Semana de teste · ${p.name}`, MAX_SUBJECT);
    const base = p.entry
      ? `Semana de entrada · ${p.name}`
      : p.week != null && p.weeks
        ? `Semana ${p.week} de ${p.weeks} · ${p.name}`
        : p.week != null
          ? `Semana ${p.week} · ${p.name}`
          : p.name;
    if (!p.today) return clip(base, MAX_SUBJECT);
    const prefix = `${base} — hoje: `;
    if (prefix.length >= MAX_SUBJECT - 4) return clip(base, MAX_SUBJECT);
    return prefix + clip(p.today.name, MAX_SUBJECT - prefix.length);
  }
  if (d.block) {
    return clip(d.block.nextName ? `Bloco concluído: hora do ${d.block.nextName}` : `Bloco concluído: ${d.block.name}`, MAX_SUBJECT);
  }
  return "Sua semana na FGPOWER";
}

export function digestPreheader(d: DigestData): string {
  if (!d.lastWeek || d.lastWeek.done === 0) return "Semana passada: nenhum treino. Esta semana é um recomeço.";
  const parts = [`Semana passada: ${d.lastWeek.done}/${d.lastWeek.target} treinos`];
  if (d.records.length > 0) parts.push(plural(d.records.length, "recorde", "recordes"));
  if (d.streak.current >= 1) parts.push(`${plural(d.streak.current, "semana seguida", "semanas seguidas")} no alvo`);
  return parts.join(" · ");
}

export function weeklyDigestEmail(d: DigestData) {
  const blocks: EmailBlock[] = [{ type: "heading", text: "Semana passada" }];
  const lw = d.lastWeek;
  if (!lw || lw.done === 0) {
    blocks.push({ type: "paragraph", text: "Nenhum treino registrado. Esta semana é um recomeço." });
  } else if (lw.deload) {
    blocks.push({ type: "paragraph", text: `${plural(lw.done, "treino", "treinos")} · semana de deload` });
  } else {
    const missing = Math.max(0, lw.target - lw.done);
    blocks.push({
      type: "paragraph",
      text: lw.met
        ? `${lw.done}/${lw.target} treinos · semana no alvo ✓`
        : `${lw.done}/${lw.target} treinos · ${pluralWord(missing, "faltou", "faltaram")} ${missing}`,
    });
  }
  if (d.streak.current >= 2) {
    blocks.push({ type: "paragraph", text: `${d.streak.current} semanas seguidas no alvo · recorde ${d.streak.best}`, muted: true });
  }
  if (d.records.length > 0) {
    const shown = d.records.slice(0, 2).join(", ");
    const more = d.records.length > 2 ? ` (+${d.records.length - 2})` : "";
    blocks.push({ type: "paragraph", text: `Recordes: ${shown}${more}` });
  }
  if (d.muscles.length > 0) {
    const top = d.muscles.slice(0, 3).map((m) => `${m.name} ${formatNumber(m.sets, 1)}`);
    blocks.push({ type: "paragraph", text: `Volume: ${top.join(" · ")} séries`, muted: true });
  }

  blocks.push({ type: "heading", text: "Esta semana" });
  const p = d.program;
  if (p) {
    const head = [p.name];
    if (p.entry) head.push("semana de entrada");
    else if (p.week != null) head.push(p.weeks ? `Semana ${p.week} de ${p.weeks}` : `Semana ${p.week}`);
    if (p.test) head.push("semana de teste");
    if (p.rir != null) head.push(`RIR alvo ${formatNumber(p.rir, 1)}`);
    blocks.push({ type: "paragraph", text: head.join(" · "), strong: true });
    if (p.note) blocks.push({ type: "paragraph", text: `“${clip(p.note, MAX_NOTE)}”`, muted: true });
    const lines: string[] = [];
    if (p.days) lines.push(`Dias: ${p.days}`);
    if (p.today) lines.push(`Hoje: ${p.today.name} · ${plural(p.today.exerciseCount, "exercício", "exercícios")}`);
    if (lines.length > 0) blocks.push({ type: "list", items: lines });
  } else if (d.block) {
    blocks.push({
      type: "paragraph",
      text: d.block.nextName
        ? `Você concluiu ${d.block.name}. O próximo passo é o ${d.block.nextName}.`
        : `Você concluiu ${d.block.name}. Escolha o próximo programa na FGPOWER.`,
    });
  } else {
    blocks.push({ type: "paragraph", text: "Nenhum programa ativo. Escolha um para ter o treino de cada dia pronto." });
  }

  const { html, text } = renderEmail({
    preheader: digestPreheader(d),
    kicker: `FGPOWER · RESUMO SEMANAL · ${formatDayTag(d.todayNo)}`,
    title: d.firstName ? `Olá, ${d.firstName}.` : "Olá.",
    blocks,
    cta: { label: p?.today ? "Abrir o treino de hoje" : "Ver minha semana", href: d.urls.cta },
    footer: {
      lines: ["Você recebe este resumo porque ativou “Resumo semanal por e-mail” na FGPOWER."],
      links: [
        { label: "Parar de receber", href: d.urls.unsubscribe },
        { label: "Preferências de lembretes", href: d.urls.preferences },
      ],
    },
  });
  return { subject: digestSubject(d), html, text };
}
