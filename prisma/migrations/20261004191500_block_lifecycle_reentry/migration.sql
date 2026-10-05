-- Batch 5 · enrollment / block lifecycle & re-entry (A-024, A-027).
--
-- A-024 · mark an enrollment that a builder "Duração" edit ended mid-block. It
-- is stored as a STOPPED (ABANDONED) block — resumable, with no
-- PROGRAM_COMPLETED achievement — and this flag tells the re-entry surfaces
-- (getProgramRestart → the program page) to say so. Only ever true alongside
-- status = 'ABANDONED'. Existing rows default to false (no past block was ended
-- this way), so no backfill is needed.
ALTER TABLE "ProgramEnrollment"
  ADD COLUMN "endedByDurationEdit" BOOLEAN NOT NULL DEFAULT false;

-- A-027 · back the new "any enrollment started after this block ended" lookups
-- (getRecentlyCompletedBlock, completedBlockToFollow) and getProgramRestart's
-- newest-first candidate scan, all keyed on (userId, startedAt).
CREATE INDEX IF NOT EXISTS "ProgramEnrollment_userId_startedAt_idx"
  ON "ProgramEnrollment" ("userId", "startedAt");
