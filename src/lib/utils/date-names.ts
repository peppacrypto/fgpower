/**
 * pt-BR month and weekday names — one source for every screen. Weekday arrays
 * are Sunday-indexed (index 0 = Sunday), matching `wallClock().weekday` and the
 * `getUTCDay()` of a São-Paulo day number. The calendar math (which day a date
 * falls on) lives in `lib/training/week` and `day-rotation`; this module only
 * names days and months for display, so a spelling fix reaches every rendering.
 *
 * The short/upper/title variants are derived from the full names (proven
 * character-for-character identical to the literals they replace), so there is
 * a single source to correct. Months are index 0 = January.
 */

/** Full month names, index 0 = January ("Janeiro"). */
export const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Three-letter month names, lower-case ("jan"). */
export const MONTHS_SHORT = MONTHS_FULL.map((m) => m.slice(0, 3).toLowerCase());

/** Three-letter month names, upper-case ("JAN"). */
export const MONTHS_SHORT_UPPER = MONTHS_FULL.map((m) => m.slice(0, 3).toUpperCase());

/** Full weekday names, Sunday-indexed, lower-case ("domingo"). */
export const WEEKDAYS_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Three-letter weekday names, Sunday-indexed, lower-case ("dom"). */
export const WEEKDAYS_SHORT = WEEKDAYS_FULL.map((w) => w.slice(0, 3).toLowerCase());

/** Three-letter weekday names, Sunday-indexed, upper-case ("DOM"). */
export const WEEKDAYS_SHORT_UPPER = WEEKDAYS_FULL.map((w) => w.slice(0, 3).toUpperCase());

/** Three-letter weekday names, Sunday-indexed, title-case ("Dom"). */
export const WEEKDAYS_SHORT_CAP = WEEKDAYS_FULL.map((w) => w.slice(0, 1).toUpperCase() + w.slice(1, 3).toLowerCase());
