import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A-004 — guard the production backup/DR tooling. These scripts are not run
 * under vitest (they talk to Railway), so we lock the invariants that make the
 * disaster-recovery guarantee real: an off-platform compressed dump taken from
 * inside the Postgres container, a fail-closed pre-migration hook, retention,
 * and a committed runbook.
 */

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

describe("scripts/backup-prod.sh (A-004)", () => {
  const script = read("scripts/backup-prod.sh");

  it("is executable", () => {
    const mode = statSync(path.join(repoRoot, "scripts/backup-prod.sh")).mode;
    expect(mode & 0o111).not.toBe(0); // at least one execute bit
  });

  it("fails closed and uses strict bash", () => {
    expect(script).toContain("set -euo pipefail");
  });

  it("unsets the project RAILWAY_TOKEN so `railway ssh` uses the account token (A-004 verify)", () => {
    // tokens.env defines RAILWAY_TOKEN (project token); if left set the CLI
    // prefers it and `railway ssh` fails "Not signed in", so the dump always
    // fails and — via the fail-closed deploy hook — blocks every deploy.
    expect(script).toContain("unset RAILWAY_TOKEN");
  });

  it("dumps the Postgres service in portable custom format from inside the container", () => {
    // custom format (restorable, selective) + portable role handling
    expect(script).toContain("pg_dump -Fc");
    expect(script).toContain("--no-owner");
    expect(script).toContain("--no-privileges");
    // runs inside the Postgres service container (version-matched, private net)
    expect(script).toContain("ssh");
    expect(script).toContain("823d6fd2-87d8-4195-9f81-540cd5033f1b");
    // the container shell expands its own DATABASE_URL, not a local var
    expect(script).toContain('sh -c \'pg_dump');
    expect(script).toContain('"$DATABASE_URL"');
  });

  it("verifies the dump and removes a bad one instead of keeping it", () => {
    expect(script).toContain("PGDMP"); // custom-format magic header check
    expect(script).toMatch(/rm -f "\$out"[\s\S]*exit 1/);
  });

  it("enforces a retention window", () => {
    expect(script).toContain("FG_BACKUP_KEEP");
    expect(script).toContain("Pruning");
  });

  it("keeps dumps out of the repo by default", () => {
    expect(script).toContain('FG_BACKUP_DIR:-$HOME/fgpower-backups');
  });
});

describe("scripts/deploy-prod.sh pre-migration hook (A-004)", () => {
  const deploy = read("scripts/deploy-prod.sh");

  it("takes a backup before `railway up` triggers the migration", () => {
    const backupAt = deploy.indexOf("backup-prod.sh");
    const upAt = deploy.indexOf("up --ci");
    expect(backupAt).toBeGreaterThan(-1);
    expect(upAt).toBeGreaterThan(-1);
    expect(backupAt).toBeLessThan(upAt); // backup strictly precedes the deploy
  });

  it("is fail-closed with an explicit opt-out", () => {
    expect(deploy).toContain("FG_SKIP_BACKUP");
  });
});

describe(".gitignore / docs (A-004)", () => {
  it("ignores dump files", () => {
    const gi = read(".gitignore");
    expect(gi).toContain("*.dump");
  });

  it("ships a restore runbook", () => {
    const doc = read("docs/BACKUP_RESTORE.md");
    expect(doc).toMatch(/restore drill/i);
    expect(doc).toMatch(/retention/i);
    expect(doc).toMatch(/Owner checklist/i);
  });
});
