import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

/**
 * The single E2E database helper (A-092). Both access paths below are built on
 * the same DATABASE_URL so they can never drift to different databases:
 *
 *  - `pool`  — an async pg.Pool for typed reads/writes (replaces the per-spec
 *              `new pg.Pool(...)` copies). Timestamps come back as UTC, since
 *              Prisma stores DateTime in `timestamp without time zone` as UTC.
 *  - `sql()` — a synchronous psql call for the many specs that seed or assert
 *              with plain strings. psql is not on the host, so it runs inside
 *              the local Postgres container (docker compose's fgpower-postgres),
 *              targeting the database named in DATABASE_URL.
 *
 * `e2e/global-setup.ts` proves, before any test runs, that both paths reach the
 * same live database — otherwise the whole run fails fast instead of dozens of
 * tests skipping in silence.
 */

const dbUrl = new URL(process.env.DATABASE_URL ?? "postgres://missing");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbUrl.hostname)) {
  throw new Error("E2E talks to the database directly — local databases only (check DATABASE_URL).");
}

/** The database name from DATABASE_URL (its path, minus the leading slash). */
export const DB_NAME = decodeURIComponent(dbUrl.pathname.replace(/^\//, "")) || "fgpower";

/** The docker container serving the local Postgres (docker compose's service name). */
const CONTAINER = process.env.E2E_PG_CONTAINER ?? "fgpower-postgres";

/**
 * Shared connection pool on DATABASE_URL. Lazy (no connection until the first
 * query) and `allowExitOnIdle` so the single worker exits cleanly without a
 * per-spec `pool.end()`. Never call `pool.end()` from a spec — it is shared
 * across every spec in the worker.
 */
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  allowExitOnIdle: true,
  types: {
    getTypeParser: ((oid: number, format?: "text" | "binary") =>
      oid === pg.types.builtins.TIMESTAMP
        ? (value: string) => new Date(`${value.replace(" ", "T")}Z`)
        : pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
  },
});

/**
 * Runs SQL against the local Postgres container and returns psql's unaligned
 * output ("a|b" rows, one per line). Stops at the first error. Synchronous:
 * for the string-based seed/assert helpers that run outside Playwright's async
 * flow (setProfile, follow, …). Local databases only.
 */
export function sql(query: string): string {
  return execSync(`docker exec -i ${CONTAINER} sh -c 'psql -U "$POSTGRES_USER" -d ${DB_NAME} -At -v ON_ERROR_STOP=1'`, {
    encoding: "utf8",
    input: query,
  }).trim();
}

/** A SQL string literal (single quotes doubled). */
export function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Whether the local database is reachable through `sql()`. With global-setup in
 * place this is always true at test time (the run fails fast otherwise); kept so
 * the existing `test.skip(!hasDb, …)` guards still compile and short-circuit.
 */
export const hasDb = (() => {
  try {
    return sql("SELECT 1") === "1";
  } catch {
    return false;
  }
})();
