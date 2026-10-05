-- A-007 · At most one ACTIVE program enrollment per user.
--
-- Two overlapping "activate program" requests could create two ACTIVE
-- enrollments; later workouts then linked to an enrollment Today never showed
-- (the "treino não salvou" family). The activation server actions now serialize
-- per user (pg_advisory_xact_lock) and re-read the active enrollment under the
-- lock; this PARTIAL UNIQUE INDEX is the database-level guard that makes the
-- invariant impossible to break regardless of the code path.
--
-- Prisma 7 cannot express a partial (filtered) unique index in schema.prisma,
-- so it lives here as raw SQL and is only documented in the model. Do NOT run
-- `prisma migrate dev` to generate migrations — it would try to drop this
-- index. Migrations in this repo are hand-authored.

-- 1. Defensive de-dup: collapse any pre-existing duplicate ACTIVE enrollments
--    to a single one per user BEFORE the unique index is created, so CREATE
--    INDEX cannot fail on live data. Keep the one Today already picks — the
--    greatest startedAt (tie-break: latest createdAt, then id) — and abandon
--    the rest. History is preserved (status ABANDONED, endedAt stamped); their
--    already-linked workouts keep pointing at them (no reassignment here).
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "userId"
      ORDER BY "startedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "ProgramEnrollment"
  WHERE "status" = 'ACTIVE'
)
UPDATE "ProgramEnrollment" e
SET "status" = 'ABANDONED',
    "endedAt" = COALESCE(e."endedAt", now())
FROM ranked
WHERE e."id" = ranked."id"
  AND ranked.rn > 1;

-- 2. The guard: at most one ACTIVE enrollment per user.
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramEnrollment_userId_active_key"
  ON "ProgramEnrollment" ("userId")
  WHERE "status" = 'ACTIVE';
