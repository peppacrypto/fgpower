-- A-036 · Index the FK columns that carry ON DELETE actions but lack a backing index.
--
-- Postgres does NOT auto-create an index for a foreign-key column. When a parent
-- row is deleted, every ON DELETE CASCADE / SET NULL action seq-scans the child
-- table once per parent row. On the LGPD account-erasure path this compounds:
-- deleting an engaged user (better-auth deleteUser -> DB cascade) scanned
-- ExercisePersonalRecord once per SetLog and once per WorkoutSession, turning one
-- request into minutes of work past the request timeout.
--
-- These nine indexes back the ON DELETE actions on:
--   ProgramEnrollment.programId           (CASCADE  -- UserProgram delete)
--   WorkoutSession.enrollmentId           (SET NULL -- ProgramEnrollment delete)
--   WorkoutSession.programDayId           (SET NULL -- UserProgramDay delete)
--   WorkoutExerciseLog.programExerciseId  (SET NULL -- UserProgramExercise delete)
--   ExercisePersonalRecord.setLogId       (SET NULL -- SetLog delete)
--   ExercisePersonalRecord.sessionId      (CASCADE  -- WorkoutSession delete)
--   Notification.actorId                  (CASCADE  -- actor User delete)
--   Notification.followRequestId          (CASCADE  -- FollowRequest delete)
--   Notification.activityId               (CASCADE  -- Activity delete)
--
-- WorkoutSession.programId (SET NULL -- UserProgram delete) is deliberately NOT
-- indexed here: the composite WorkoutSession(programId, status) added by A-037
-- (migration 20261004190100) has programId as its leading column and already
-- backs that cascade, so a standalone single-column index would be redundant.
--
-- Names and shapes match exactly what `@@index([col])` in schema.prisma emits, so
-- the schema and the database stay in sync (no drift). Plain CREATE INDEX: prisma
-- migrate runs each migration inside a transaction and CREATE INDEX CONCURRENTLY
-- cannot run there. These tables are small enough at deploy time that a brief
-- ACCESS SHARE-blocking build is acceptable; the point is to land the indexes
-- before the tables grow. Hand-authored (migrations in this repo are not generated
-- by `prisma migrate dev`); IF NOT EXISTS keeps a re-run / partial apply safe.

CREATE INDEX IF NOT EXISTS "ProgramEnrollment_programId_idx" ON "ProgramEnrollment"("programId");
CREATE INDEX IF NOT EXISTS "WorkoutSession_enrollmentId_idx" ON "WorkoutSession"("enrollmentId");
CREATE INDEX IF NOT EXISTS "WorkoutSession_programDayId_idx" ON "WorkoutSession"("programDayId");
CREATE INDEX IF NOT EXISTS "WorkoutExerciseLog_programExerciseId_idx" ON "WorkoutExerciseLog"("programExerciseId");
CREATE INDEX IF NOT EXISTS "ExercisePersonalRecord_setLogId_idx" ON "ExercisePersonalRecord"("setLogId");
CREATE INDEX IF NOT EXISTS "ExercisePersonalRecord_sessionId_idx" ON "ExercisePersonalRecord"("sessionId");
CREATE INDEX IF NOT EXISTS "Notification_actorId_idx" ON "Notification"("actorId");
CREATE INDEX IF NOT EXISTS "Notification_followRequestId_idx" ON "Notification"("followRequestId");
CREATE INDEX IF NOT EXISTS "Notification_activityId_idx" ON "Notification"("activityId");
