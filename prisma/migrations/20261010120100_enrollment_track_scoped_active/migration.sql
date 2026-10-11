-- Parallel program tracks: the "one ACTIVE enrollment per user" rule becomes
-- "one ACTIVE enrollment per user PER TRACK", so a complementary plan (yoga /
-- mobility) can run alongside the primary strength plan (e.g. the GD series)
-- WITHOUT ending it. The primary track keeps its exact previous behaviour: one
-- active primary program, which still owns the user's week.
--
-- `track` is denormalized from the program's goal (programming/tracks.ts
-- trackOf). Prisma 7 cannot express a partial (filtered) unique index in
-- schema.prisma, so the swap lives here as raw SQL. Do NOT run `prisma migrate
-- dev` — it would drop the partial index. Migrations here are hand-authored.

-- 1. The track column. Default 'primary' so every existing enrollment (and any
--    created before the backfill) is treated as the scheduled strength plan.
ALTER TABLE "ProgramEnrollment"
  ADD COLUMN IF NOT EXISTS "track" TEXT NOT NULL DEFAULT 'primary';

-- 2. Backfill from each enrollment's program goal. Only MOBILITY/YOGA move off
--    'primary'; everything else (incl. NULL goal) stays 'primary'. At this
--    point no YOGA program exists yet, so that branch is a harmless no-op, but
--    it makes the rule explicit and correct for any future backfill run.
UPDATE "ProgramEnrollment" pe
SET "track" = CASE up."goal"
      WHEN 'MOBILITY' THEN 'mobility'
      WHEN 'YOGA'     THEN 'yoga'
      ELSE 'primary'
    END
FROM "UserProgram" up
WHERE up."id" = pe."programId"
  AND pe."track" <> (CASE up."goal"
        WHEN 'MOBILITY' THEN 'mobility'
        WHEN 'YOGA'     THEN 'yoga'
        ELSE 'primary'
      END);

-- 3. Defensive de-dup: should the live data somehow already hold two ACTIVE
--    enrollments in the same (user, track) — e.g. two mobility plans that were
--    both active under the old user-wide index before this split — keep the one
--    Today picks (greatest startedAt, then createdAt, then id) and abandon the
--    rest, so the new unique index cannot fail on CREATE.
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "userId", "track"
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

-- 4. Swap the guard: drop the user-wide partial unique index and replace it
--    with a per-(user, track) one. One ACTIVE enrollment per track.
DROP INDEX IF EXISTS "ProgramEnrollment_userId_active_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramEnrollment_userId_track_active_key"
  ON "ProgramEnrollment" ("userId", "track")
  WHERE "status" = 'ACTIVE';
