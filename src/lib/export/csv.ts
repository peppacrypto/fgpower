/**
 * CSV the way Brazilian Excel opens it with a double click (W-151): UTF-8
 * with a BOM (else accents break), ";" between fields (the comma is the
 * decimal mark), CRLF line ends, decimal commas. Google Sheets detects the
 * ";" too. Pure; reusable by any other export.
 */

export type CsvCell = string | number | null | undefined;

const BOM = "﻿";
const CRLF = "\r\n";

/**
 * A number with a decimal comma, at most `digits` decimals and no thousands
 * separator ("44,63", "1250"); empty for null/NaN.
 */
export function csvDecimal(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  const f = 10 ** digits;
  const rounded = Math.round(n * f) / f;
  return String(Object.is(rounded, -0) ? 0 : rounded).replace(".", ",");
}

/**
 * Text a spreadsheet would run as a formula (= + - @, or a leading tab / CR)
 * gets a leading apostrophe, so a workout named "=HYPERLINK(…)" stays text.
 * Only for text: numbers are written by csvDecimal and never start with one
 * of these but "-", which a real negative number may.
 */
export function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function field(cell: CsvCell, delimiter: string): string {
  if (cell === null || cell === undefined) return "";
  const text = typeof cell === "number" ? csvDecimal(cell) : neutralizeFormula(cell);
  const needsQuotes =
    text.includes(delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r") || text !== text.trim();
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole file: BOM, the header row and every row, each line ended by CRLF. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[], opts: { delimiter?: string } = {}): string {
  const delimiter = opts.delimiter ?? ";";
  const line = (cells: readonly CsvCell[]) => cells.map((c) => field(c, delimiter)).join(delimiter) + CRLF;
  return BOM + line(header) + rows.map(line).join("");
}
