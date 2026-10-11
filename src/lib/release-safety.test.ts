import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Roll-forward-only guard (audit A-038).
 *
 * Postgres `ALTER TYPE … ADD VALUE` is irreversible and `prisma migrate` has no
 * down step, so every enum value a migration adds becomes a value an OLDER image's
 * generated Prisma client cannot read: a one-click Railway rollback boots, then
 * throws P2023 on live rows. See docs/RELEASE_SAFETY.md.
 *
 * This test does not touch a database. It scans the committed migrations for every
 * `ADD VALUE` and asserts the set exactly matches the reviewed registry below.
 * Adding a new enum value therefore fails CI until someone consciously registers
 * it here AND updates docs/RELEASE_SAFETY.md — the moment to prefer a TEXT column
 * or a reader-before-writer release instead.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));

/** Every enum value added by a committed migration, as `Type.VALUE`. Keep in sync with docs/RELEASE_SAFETY.md. */
const REGISTERED_ADDED_ENUM_VALUES = new Set<string>([
  "TrainingGoal.FAT_LOSS", // 20260926120000_training_goal_fat_loss
  "NotificationType.WORKOUT_MILESTONE", // 20260929100000_social_core (95e3c69) — first roll-forward-only release
  "TrainingGoal.MOBILITY", // 20261003120000_mobility_goal_and_style (3631d91)
  "TrainingStyle.MOBILITY", // 20261003120000_mobility_goal_and_style (3631d91)
  "TrainingGoal.YOGA", // 20261010120000_yoga_goal_and_style
  "TrainingStyle.YOGA", // 20261010120000_yoga_goal_and_style
  "TrainingGoal.CALISTHENICS_SKILL", // 20261011120000_calisthenics_goal_and_style
  "TrainingStyle.CALISTHENICS", // 20261011120000_calisthenics_goal_and_style
]);

const ADD_VALUE = /ALTER\s+TYPE\s+"(\w+)"\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']+)'/gi;

function addedEnumValues(): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let sql: string;
    try {
      sql = readFileSync(join(MIGRATIONS_DIR, entry.name, "migration.sql"), "utf8");
    } catch {
      continue; // a migration folder without a .sql file (none today) is not our concern
    }
    for (const match of sql.matchAll(ADD_VALUE)) found.push(`${match[1]}.${match[2]}`);
  }
  return found;
}

describe("release safety — roll-forward-only enum additions (A-038)", () => {
  const added = addedEnumValues();

  it("finds the known roll-forward-only enum additions", () => {
    // Guards the scanner itself: if the regex ever stops matching, the equality
    // test below would pass vacuously.
    expect(added.length).toBeGreaterThanOrEqual(REGISTERED_ADDED_ENUM_VALUES.size);
  });

  it("every ADD VALUE in the migrations is registered (and vice versa)", () => {
    expect(new Set(added)).toEqual(REGISTERED_ADDED_ENUM_VALUES);
  });

  it("registry has no duplicates vs. the migrations", () => {
    // An IF-NOT-EXISTS re-add in a later migration would double-count; flag it so
    // the registry/runbook author notices.
    const counts = new Map<string, number>();
    for (const v of added) counts.set(v, (counts.get(v) ?? 0) + 1);
    const duplicated = [...counts].filter(([, n]) => n > 1).map(([v]) => v);
    expect(duplicated, `enum values added by more than one migration: ${duplicated.join(", ")}`).toEqual([]);
  });
});

describe("the scanner (negative controls)", () => {
  const scan = (sql: string): string[] => [...sql.matchAll(ADD_VALUE)].map((m) => `${m[1]}.${m[2]}`);

  it("matches IF NOT EXISTS and bare ADD VALUE", () => {
    expect(scan(`ALTER TYPE "Foo" ADD VALUE IF NOT EXISTS 'BAR';`)).toEqual(["Foo.BAR"]);
    expect(scan(`ALTER TYPE "Foo" ADD VALUE 'BAZ';`)).toEqual(["Foo.BAZ"]);
  });

  it("ignores unrelated DDL", () => {
    expect(scan(`ALTER TABLE "Foo" ADD COLUMN "bar" TEXT;`)).toEqual([]);
    expect(scan(`CREATE TYPE "Foo" AS ENUM ('A', 'B');`)).toEqual([]);
  });
});
