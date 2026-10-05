-- A-091 · Reminder auto-resume: bounded, indexed, no N+1.
--
-- The resume pass used to scan an unordered take:2000 of paused users and run
-- one "last workout" query per user every 5 minutes (src/lib/reminders/engine.ts).
-- It is now a single correlated statement:
--   UPDATE "ReminderPreference" rp
--   SET "pausedAt" = NULL, "pausedReason" = NULL, "resumedAt" = <now>, "updatedAt" = <now>
--   WHERE rp."pausedAt" IS NOT NULL
--     AND EXISTS (SELECT 1 FROM "WorkoutSession" ws
--                 WHERE ws."userId" = rp."userId"
--                   AND ws."startedAt" > rp."pausedAt"
--                   AND ws."startedAt" <= <now>);
-- The EXISTS is served by the existing WorkoutSession(userId, startedAt) index;
-- this PARTIAL INDEX lets the outer UPDATE find the (few) paused rows without a
-- full table scan.
--
-- Prisma 7 cannot express a partial (filtered) index in schema.prisma, so it
-- lives here as raw SQL and is only documented in the model. Do NOT run
-- `prisma migrate dev` to generate migrations — it does not see this index and
-- would drop it; migrations in this repo are hand-authored.
CREATE INDEX IF NOT EXISTS "ReminderPreference_pausedAt_idx"
  ON "ReminderPreference" ("pausedAt")
  WHERE "pausedAt" IS NOT NULL;
