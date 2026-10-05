-- A-012 / A-022 / A-047 · Durable moderation + report retention across account deletion.
--
-- A-012: a durable moderation marker on the workout itself, so an admin's
--   "Excluir publicação" survives the Activity row being removed — the owner
--   cannot re-publish or re-share the moderated workout.
-- A-022: a UserReport must OUTLIVE the reporter or the reported user deleting
--   their account. The report's snapshot keeps the evidence; the identities go
--   NULL instead of cascading the whole report away.
-- A-047: repair fgCount counters already inflated by past account deletions
--   (the going-forward fix is the deleteUser.beforeDelete hook in code).
--
-- Additive and idempotent where possible. The FK indexes added in Lote 3
-- (UserReport_reporterId_createdAt_idx, UserReport_reportedUserId_idx) are left
-- in place and still back these SET NULL actions.

-- A-012 · WorkoutSession.moderatedAt (additive, nullable; existing rows stay NULL).
ALTER TABLE "WorkoutSession" ADD COLUMN "moderatedAt" TIMESTAMP(3);

-- A-022 · the reporter is now optional, and its FK no longer cascades the report away.
ALTER TABLE "UserReport" ALTER COLUMN "reporterId" DROP NOT NULL;

ALTER TABLE "UserReport" DROP CONSTRAINT "UserReport_reporterId_fkey";
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A-022 · the reported user's FK goes SET NULL too (the column was already nullable).
ALTER TABLE "UserReport" DROP CONSTRAINT "UserReport_reportedUserId_fkey";
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedUserId_fkey"
  FOREIGN KEY ("reportedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A-047 · one-off recount of counters already drifted in production (idempotent).
UPDATE "Activity" a
SET "fgCount" = sub.c
FROM (SELECT f."activityId" AS id, count(*)::int AS c FROM "ActivityFG" f GROUP BY f."activityId") sub
WHERE a."id" = sub.id AND a."fgCount" <> sub.c;

-- Activities that lost all their FGs to deletions settle back to 0.
UPDATE "Activity" a
SET "fgCount" = 0
WHERE a."fgCount" <> 0 AND NOT EXISTS (SELECT 1 FROM "ActivityFG" f WHERE f."activityId" = a."id");
