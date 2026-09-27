/**
 * Plain-Portuguese meanings for the jargon in program notes ("top set",
 * "back-off", "superset", "benchmark"…). The dossier lists only the terms
 * its own notes use, right under the plan.
 */
export interface GlossaryEntry {
  term: string;
  meaning: string;
}

/**
 * A whole-word, case-insensitive pattern. JavaScript's `\b` only knows ASCII
 * letters — there is no boundary between a space and "â" — so words are
 * delimited by "no letter or digit on either side" instead, which works for
 * "Âncora" and "excêntrica" alike.
 */
function word(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, "iu");
}

const GLOSSARY: (GlossaryEntry & { pattern: RegExp })[] = [
  { term: "Falha", pattern: word("falha"), meaning: "a repetição em que não sai mais nenhuma com boa técnica (RIR 0)." },
  { term: "Âncora", pattern: word("[âa]ncora"), meaning: "o exercício principal do dia, em que a evolução é medida." },
  {
    term: "Top set",
    pattern: word("top[- ]sets?"),
    meaning: "a série mais pesada do exercício, feita depois do aquecimento.",
  },
  {
    term: "Back-off",
    pattern: word("back[- ]?offs?"),
    meaning: "séries mais leves depois do top set, para somar volume com boa técnica.",
  },
  {
    term: "Superset",
    pattern: word("(super[- ]?sets?|supers[ée]ries?|bi[- ]?sets?)"),
    meaning: "dois exercícios alternados, descansando só depois do segundo.",
  },
  {
    term: "Drop set",
    pattern: word("drop[- ]?sets?"),
    meaning: "ao chegar perto da falha, tire ~20–30% da carga e continue sem descanso.",
  },
  {
    term: "Myo-reps",
    pattern: word("myo[- ]?reps?"),
    meaning: "uma série de ativação e depois minisséries de 3–5 reps com 15–20 s de pausa.",
  },
  {
    term: "Rest-pause",
    pattern: word("rest[- ]?pause"),
    meaning: "uma pausa curta (10–20 s) no meio da série para tirar mais algumas reps.",
  },
  {
    term: "Benchmark",
    pattern: word("benchmark"),
    meaning: "um exercício-teste: anote a carga e as reps para comparar a evolução no fim do bloco.",
  },
  { term: "Excêntrica", pattern: word("exc[êe]ntric[ao]s?"), meaning: "a fase de descida do movimento." },
  {
    term: "Parciais",
    pattern: word("parcia(l|is)"),
    meaning: "repetições com amplitude reduzida, em geral na parte alongada do movimento.",
  },
  {
    term: "Cadência",
    pattern: word("cad[êe]ncia"),
    meaning: "o ritmo de cada repetição, em segundos por fase (ex.: 3 s descendo).",
  },
];

/** The entries whose term appears in any of the given texts, in glossary order. */
export function glossaryFor(texts: (string | null | undefined)[]): GlossaryEntry[] {
  const all = texts.filter(Boolean).join("\n");
  return GLOSSARY.filter((g) => g.pattern.test(all)).map(({ term, meaning }) => ({ term, meaning }));
}
