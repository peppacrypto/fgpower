import { DB_NAME, pool, sql } from "./db";

/**
 * Playwright global setup (A-092): prove BOTH database paths reach the SAME live
 * database before any test runs. Without this, a stopped container or a
 * mispointed DATABASE_URL made DB-backed tests skip in silence while the run
 * still exited 0.
 */
export default async function globalSetup() {
  // 1. The async pool (DATABASE_URL) is reachable.
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    throw new Error(
      `E2E setup: cannot reach the database at DATABASE_URL (${DB_NAME}). Start it and migrate before running the suite.\n${String(err)}`,
    );
  }

  // 2. The synchronous sql() path (docker container) is reachable.
  let viaDocker: string;
  try {
    viaDocker = sql("SELECT 1");
  } catch (err) {
    throw new Error(
      `E2E setup: the local Postgres container is not reachable through docker exec. Start it (see README) or set E2E_PG_CONTAINER.\n${String(err)}`,
    );
  }
  if (viaDocker !== "1") throw new Error(`E2E setup: unexpected sql() result ${JSON.stringify(viaDocker)}`);

  // 3. Both paths hit the same physical database: write a sentinel through the
  //    pool and read it back through docker. If DATABASE_URL and the container
  //    diverge, this fails loudly (A-092's second half).
  const token = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await pool.query(`CREATE TABLE IF NOT EXISTS "_e2e_db_check" (token text)`);
  await pool.query(`TRUNCATE "_e2e_db_check"`);
  await pool.query(`INSERT INTO "_e2e_db_check" (token) VALUES ($1)`, [token]);
  const echoed = sql(`SELECT token FROM "_e2e_db_check"`);
  await pool.query(`DROP TABLE "_e2e_db_check"`);
  if (echoed !== token) {
    throw new Error(
      `E2E setup: the two database paths disagree — the pool (DATABASE_URL) and docker exec reach different databases. ` +
        `sql() read ${JSON.stringify(echoed)}, expected ${JSON.stringify(token)}.`,
    );
  }

  // The pool opened here lives in the setup process; close it so it doesn't hold
  // the process open. Each worker opens its own from e2e/db.ts.
  await pool.end();
}
