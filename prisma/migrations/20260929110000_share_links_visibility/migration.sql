-- Batch 5 · share links, default visibility, moderation, workout preferences
-- (W-008/048/141/149, decision 10 as decided: D-A).
--
-- Activity.shareToken: link-only access to one workout (/t/<token>), minted
-- only by an explicit owner tap. moderatedAt: hidden by an admin, so the owner
-- can't publish or share it again. Additive only; safe to re-run.

ALTER TABLE "Activity"
  ADD COLUMN IF NOT EXISTS "shareToken" TEXT,
  ADD COLUMN IF NOT EXISTS "sharedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Activity_shareToken_key" ON "Activity"("shareToken");

-- New profiles publish finished workouts to their followers (loads hidden:
-- showLoadsPublicly stays false). Existing profiles are NOT backfilled: their
-- stored PRIVATE stays, and the summary offers the switch once.
-- Profile.autoShareAchievements is kept (unused) so an image rollback still reads it.
ALTER TABLE "Profile" ALTER COLUMN "defaultWorkoutVisibility" SET DEFAULT 'FOLLOWERS';

-- Settings → Durante o treino → "Vibração".
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "hapticsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- One-time prompts dismissed for good ("Manter privado"), per account.
CREATE TABLE IF NOT EXISTS "UserDismissal" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDismissal_pkey" PRIMARY KEY ("userId","key")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserDismissal_userId_fkey') THEN
    ALTER TABLE "UserDismissal" ADD CONSTRAINT "UserDismissal_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
