/**
 * Short chips for a program's days — the "split map" on library and "Meus
 * programas" cards. Cutting every name at 9 characters used to give five
 * identical "SEGUNDA —…" chips; this reads the name instead:
 *   "Segunda — Superior A (máquinas)" → "SEG · SUP A"
 *   "Corpo Inteiro A / B / C"         → "A", "B", "C"
 *   "Dia 1 — Peito"                   → "1 · PEITO"
 *   "Push A", "Superior A — Ênfase…"  → "PUSH A", "SUPERIOR A"
 * Tokens are computed per program, so days that would read the same get the
 * part after "—" to tell them apart.
 */
import { normalizeText } from "@/lib/utils/normalize-text";

const WEEKDAY: Record<string, string> = {
  segunda: "SEG",
  terca: "TER",
  quarta: "QUA",
  quinta: "QUI",
  sexta: "SEX",
  sabado: "SÁB",
  domingo: "DOM",
};
/** "Sessão A", "Treino B", "Dia 1": a generic word plus a short id. */
const GENERIC_ID = /^(?:sess[ãa]o|treino|dia|day)\s+([a-z0-9]{1,2})$/i;
/** "Treino de perna" → "perna"; "Dia do Supino" → "Supino". */
const GENERIC_PREFIX = /^(?:sess[ãa]o|treino|dia|day)\s+(?:d[eoa]s?\s+)?(?=\S{3,})/i;
const SEPARATOR = /\s+[—–]\s+/;
const STOPWORDS = new Set(["e", "de", "do", "da", "dos", "das", "em", "com", "no", "na", "&", "+", "para"]);
/** Longest phrase kept whole ("SUPERIOR A", "AGACHAMENTO"). */
const KEEP_WHOLE = 11;
/** Longest tail shown whole next to an id ("1 · PEITO"). */
const SHORT_TAIL = 8;
const MAX_TOKEN = 14;

const upper = (s: string) => s.toLocaleUpperCase("pt-BR");

function cleanWords(s: string): string[] {
  return s
    .replace(/\(.*?\)/g, " ")
    .replace(/[,:;]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
}

/** Whether a word is a trailing id: "A", "B", "1". */
const isId = (w: string) => /^[A-Z0-9]{1,2}$/.test(w);

/** "Superior A (máquinas)" → "SUP A"; "Técnica (corpo inteiro)" → "TÉC". */
function firstWordAbbr(phrase: string): string {
  const words = cleanWords(phrase);
  if (words.length === 0) return "";
  const id = words.length > 1 && isId(words[words.length - 1]) ? words[words.length - 1] : null;
  return [upper(words[0].slice(0, 3)), id].filter(Boolean).join(" ");
}

/** A phrase as short as it can be while still readable. */
function shortPhrase(phrase: string): string {
  const cleaned = cleanWords(phrase.replace(GENERIC_PREFIX, "")).join(" ");
  if (cleaned.length <= KEEP_WHOLE) return upper(cleaned);
  const words = cleaned.split(" ");
  if (words.length === 1) return `${upper(cleaned.slice(0, 6))}.`;
  const id = isId(words[words.length - 1]) ? words[words.length - 1] : null;
  const main = (id ? words.slice(0, -1) : words).slice(0, 2).map((w) => upper(w.slice(0, 3)));
  return [...main, id].filter(Boolean).join(" ");
}

interface Parsed {
  token: string;
  /** Text after "—", without the parenthetical. */
  tail: string;
  /** "A" of "Sessão A" when the head is only a generic id. */
  genericId: string | null;
}

function parse(name: string): Parsed {
  const [rawHead, ...rest] = name.trim().split(SEPARATOR);
  const head = rawHead.trim();
  const tail = rest.join(" ").trim();
  const weekday = WEEKDAY[normalizeText(head).replace(/-feira$/, "")];
  if (weekday) return { token: tail ? `${weekday} · ${firstWordAbbr(tail)}` : weekday, tail: "", genericId: null };
  const generic = GENERIC_ID.exec(head);
  if (generic) return { token: upper(generic[1]), tail, genericId: upper(generic[1]) };
  return { token: shortPhrase(head), tail, genericId: null };
}

export function dayTokens(names: string[]): string[] {
  if (names.length === 0) return [];
  // "Corpo Inteiro A", "Corpo Inteiro B", …: only the last letter tells them apart.
  const stems = new Set(names.map((n) => n.trim().replace(/\s\S$/, "")));
  if (names.length > 1 && stems.size === 1 && names.every((n) => /\s\S$/.test(n.trim()))) {
    return names.map((n) => upper(n.trim().slice(-1)));
  }

  const parsed = names.map(parse);
  // "Dia 1 — Peito" … "Dia 5 — Braços": the tail is the information, when every one is short.
  const generic = parsed.filter((p) => p.genericId);
  if (generic.length > 0 && generic.every((p) => p.tail && cleanWords(p.tail).join(" ").length <= SHORT_TAIL)) {
    for (const p of generic) p.token = `${p.genericId} · ${upper(cleanWords(p.tail).join(" "))}`;
  }

  // Days that still read the same get their tail ("TRONCO · TEN" / "TRONCO · BOM").
  const count = (t: string) => parsed.filter((p) => p.token === t).length;
  const dupes = new Set(parsed.filter((p) => count(p.token) > 1).map((p) => p.token));
  for (const p of parsed) {
    if (!dupes.has(p.token) || !p.tail) continue;
    const tail = firstWordAbbr(p.tail);
    const withTail = `${p.token} · ${tail}`;
    const shortHead = cleanWords(p.token)
      .slice(0, 2)
      .map((w) => w.slice(0, 3))
      .join(" ");
    p.token = withTail.length <= MAX_TOKEN ? withTail : `${shortHead} · ${tail}`;
  }
  // Last resort: number the ones left identical.
  const seen = new Map<string, number>();
  return parsed.map((p) => {
    if (count(p.token) === 1) return p.token;
    const n = (seen.get(p.token) ?? 0) + 1;
    seen.set(p.token, n);
    return `${p.token} ${n}`;
  });
}

/**
 * Longest day name a button label carries. The start button wraps, and on a
 * 320px phone its second line holds ~19 characters ("Potência Inferior A"),
 * so "Ativar e iniciar <dia>" never runs to a third line.
 */
const BUTTON_NAME_MAX = 19;

/** "Empurrar + Prioridade", "Pressão & Largura", "Braços, ombros e abdômen": the parts. */
const COMPOUND = /\s*[+&,]\s*|\s+e\s+/;

/**
 * A day's name short enough for a button: the focus of weekday plans
 * ("Segunda — Superior A (máquinas)" → "Superior A"), the part before "—"
 * otherwise ("Sessão A — Agachamento e Supino" → "Sessão A"). A bare letter
 * is never a name on its own ("A — Swing & Desenvolvimento" → "Treino A"),
 * and a long compound keeps its first part ("Empurrar + Prioridade (…)" →
 * "Empurrar").
 */
export function shortDayName(name: string): string {
  const [rawHead, ...rest] = name.trim().split(SEPARATOR);
  const head = rawHead.trim();
  const tail = rest
    .join(" — ")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const short = WEEKDAY[normalizeText(head).replace(/-feira$/, "")] && tail ? tail : head;
  if (/^[a-z0-9]{1,2}$/i.test(short)) return `Treino ${upper(short)}`;
  if (short.length <= BUTTON_NAME_MAX) return short;
  const first = short.split(COMPOUND)[0];
  if (first.length >= 4 && first.length <= BUTTON_NAME_MAX) return first;
  // "Dia do Desenvolvimento Olímpico" → "Desenvolvimento Olímpico".
  const bare = short.replace(GENERIC_PREFIX, "");
  if (bare !== short && bare.length <= BUTTON_NAME_MAX) return bare[0].toLocaleUpperCase("pt-BR") + bare.slice(1);
  const cut = short.slice(0, BUTTON_NAME_MAX);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 8 ? cut.lastIndexOf(" ") : BUTTON_NAME_MAX).trimEnd()}…`;
}
