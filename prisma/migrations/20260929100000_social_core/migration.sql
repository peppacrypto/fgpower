-- Batch 5 · social core (W-042/043/044/137/141).
--
-- One notification per event: Notification.dedupeKey + UNIQUE (recipientId,
-- dedupeKey), so a follow/unfollow/follow or an FG given twice never stacks
-- rows (lib/social/notifications.ts writes every row). Rows about a workout
-- (records, week, milestone) link it by sessionId, so deleting the workout
-- deletes them. Additive only and safe to re-run: nothing is dropped and no
-- notification is deleted — duplicates keep a NULL key (NULLs never collide
-- under the unique index) and are marked read. Take a pg_dump of
-- "Notification" before running it on production anyway.

-- The 10th/25th/50th/100th workout (decision 4). Not used in this file.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WORKOUT_MILESTONE';

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_sessionId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Reports keep what was reported as it stood (the owner may delete the post).
ALTER TABLE "UserReport" ADD COLUMN IF NOT EXISTS "snapshot" JSONB;

-- Rows without an actor are the user's own achievements (a block finished):
-- an achievements log, never the unread pip.
UPDATE "Notification" SET "readAt" = "createdAt" WHERE "actorId" IS NULL AND "readAt" IS NULL;

-- An FG taken back before it was seen: the row stays, read.
UPDATE "Notification" n
SET "readAt" = now()
WHERE n.type = 'FG_RECEIVED'
  AND n."readAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ActivityFG" f WHERE f."activityId" = n."activityId" AND f."userId" = n."actorId"
  );

-- Keys, as lib/social/notifications.ts notificationKey builds them. Per
-- recipient and key, only the newest row takes the key; older duplicates keep
-- NULL and are marked read. A withdrawn FG gets no key (a later FG notifies
-- again). Groups whose key is already taken (a re-run) are left alone.
WITH keyed AS (
  SELECT
    n.id,
    n."recipientId",
    n."createdAt",
    CASE n.type
      WHEN 'FG_RECEIVED' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM "ActivityFG" f WHERE f."activityId" = n."activityId" AND f."userId" = n."actorId"
        ) THEN 'fg:' || n."activityId" || ':' || n."actorId" END
      WHEN 'NEW_FOLLOWER' THEN 'follower:' || n."actorId"
      WHEN 'FOLLOW_REQUEST' THEN 'request:' || n."actorId"
      WHEN 'FOLLOW_ACCEPTED' THEN 'accepted:' || n."actorId"
      WHEN 'PROGRAM_COMPLETED' THEN 'block:' || (n.data ->> 'enrollmentId')
    END AS key
  FROM "Notification" n
  WHERE n."dedupeKey" IS NULL
),
ranked AS (
  SELECT
    k.id,
    k.key,
    row_number() OVER (PARTITION BY k."recipientId", k.key ORDER BY k."createdAt" DESC, k.id DESC) AS rn
  FROM keyed k
  WHERE k.key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "Notification" o WHERE o."recipientId" = k."recipientId" AND o."dedupeKey" = k.key
    )
)
UPDATE "Notification" n
SET "dedupeKey" = CASE WHEN r.rn = 1 THEN r.key ELSE n."dedupeKey" END,
    "readAt" = CASE WHEN r.rn > 1 THEN COALESCE(n."readAt", now()) ELSE n."readAt" END
FROM ranked r
WHERE n.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_recipientId_dedupeKey_key" ON "Notification"("recipientId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "Notification_sessionId_idx" ON "Notification"("sessionId");

-- Reports: the per-reporter daily limit, dedupe and "N denúncias abertas sobre este alvo".
CREATE INDEX IF NOT EXISTS "UserReport_reporterId_createdAt_idx" ON "UserReport"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserReport_activityId_idx" ON "UserReport"("activityId");
CREATE INDEX IF NOT EXISTS "UserReport_reportedUserId_idx" ON "UserReport"("reportedUserId");

-- "Seguindo" lists, newest first; "Treinando o mesmo programa" in Descobrir.
CREATE INDEX IF NOT EXISTS "Follow_followerId_createdAt_idx" ON "Follow"("followerId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserProgram_sourceTemplateId_status_idx" ON "UserProgram"("sourceTemplateId", "status");
