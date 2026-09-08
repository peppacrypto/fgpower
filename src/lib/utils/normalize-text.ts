/** Lowercase + strip diacritics, so "supino" matches "Supinado" and "agachamento" matches "Agachamento". */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
