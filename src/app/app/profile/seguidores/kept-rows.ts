import { useState } from "react";

/**
 * `latest` (the server's rows, in its order) with each row as it was first
 * shown in `shown`, and the rows `latest` no longer has put back where they
 * were. Pure; see useKeptRows.
 */
export function keepRows<T extends { id: string }>(latest: readonly T[], shown: readonly T[]): T[] {
  const firstShown = new Map(shown.map((row) => [row.id, row]));
  const merged = latest.map((row) => firstShown.get(row.id) ?? row);
  const present = new Set(latest.map((row) => row.id));
  shown.forEach((row, index) => {
    if (!present.has(row.id)) merged.splice(Math.min(index, merged.length), 0, row);
  });
  return merged;
}

/**
 * A list's rows for this visit. A server re-render — router.refresh(), the
 * app resuming after a long sleep, the session cookie refreshed inside any
 * action — rebuilds the list from the DB, where a removed follower, an
 * answered request or an unblocked account is gone; unmounting its row would
 * wipe what the tap just confirmed ("Removido", "Solicitação aceita",
 * "Desbloqueado"). Here every row shown stays until the next visit, as it was
 * first shown (a "Seguir de volta" offered at first sight stays offered once
 * the server says FOLLOWING), and new rows ("Carregar mais") join in.
 * `rows` must be a server prop: the same array until the next server render.
 */
export function useKeptRows<T extends { id: string }>(rows: readonly T[]): readonly T[] {
  const [kept, setKept] = useState<{ from: readonly T[]; rows: readonly T[] }>({ from: rows, rows });
  let current = kept;
  if (kept.from !== rows) {
    current = { from: rows, rows: keepRows(rows, kept.rows) };
    setKept(current);
  }
  return current.rows;
}
