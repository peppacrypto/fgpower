/**
 * Result shapes shared by server actions and their client callers. Plain
 * types in a plain module: a 'use server' file may only export async
 * functions (its schemas and constants live in lib/validation/*).
 *
 * Every action a client calls returns one of these instead of throwing —
 * production masks thrown messages. A missing session is
 * `{ ok: false, error: SESSION_EXPIRED_ERROR }` (lib/auth/session-expired),
 * which ActionErrorText turns into "… Entrar" (decision D-L).
 */

/** An autosaved Settings-style block (components/ui/use-autosave, SaveStatus). */
export type SettingsSaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Any other action the UI calls directly: `{ ok: true, ...data }` or a pt-BR error. */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
