-- Batch 5 · body metrics, post-workout check-in, applied deload (W-083/127/128).
-- Additive only; safe to re-run.

-- BodyMetric: one value per kind per São Paulo day (the upsert key), and the
-- workout whose check-in wrote it (a deleted workout leaves the weigh-in).
ALTER TABLE "BodyMetric"
  ADD COLUMN IF NOT EXISTS "day" INTEGER,
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- The São Paulo day number, as lib/training/day-rotation dayNumberOf.
UPDATE "BodyMetric"
SET "day" = ((("measuredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date - DATE '1970-01-01')
WHERE "day" IS NULL;

ALTER TABLE "BodyMetric" ALTER COLUMN "day" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BodyMetric_sessionId_fkey') THEN
    ALTER TABLE "BodyMetric" ADD CONSTRAINT "BodyMetric_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Nothing wrote BodyMetric before Batch 5 (0 rows): two values of one kind on
-- one day can't exist. Should they, this fails loudly instead of deleting data.
CREATE UNIQUE INDEX IF NOT EXISTS "BodyMetric_userId_kind_day_key" ON "BodyMetric"("userId", "kind", "day");
CREATE INDEX IF NOT EXISTS "BodyMetric_sessionId_idx" ON "BodyMetric"("sessionId");

-- The check-in (owner-only) and whether the workout was opened in an applied deload week.
ALTER TABLE "WorkoutSession"
  ADD COLUMN IF NOT EXISTS "sessionRpe" INTEGER,
  ADD COLUMN IF NOT EXISTS "soreness" INTEGER,
  ADD COLUMN IF NOT EXISTS "shortSleep" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lingeringPain" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "highStress" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "checkInAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isDeload" BOOLEAN NOT NULL DEFAULT false;

-- Weeks the user turned into a deload (São Paulo Monday day numbers).
ALTER TABLE "ProgramEnrollment" ADD COLUMN IF NOT EXISTS "deloadMondays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
