-- Batch 5 · re-engagement (W-017/065): reminder preferences, Web Push
-- devices, reminder deliveries, the e-mail log and job leases. New tables
-- only; every row is created lazily on opt-in. Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderKind') THEN
    CREATE TYPE "ReminderKind" AS ENUM ('WEEKLY_DIGEST', 'TRAINING_DAY', 'OPEN_WORKOUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderChannel') THEN
    CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'PUSH');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderStatus') THEN
    CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ReminderPreference" (
    "userId" TEXT NOT NULL,
    "pushHour" INTEGER NOT NULL DEFAULT 18,
    "emailDigest" BOOLEAN NOT NULL DEFAULT false,
    "emailDigestOptInAt" TIMESTAMP(3),
    "emailUnsubscribedAt" TIMESTAMP(3),
    "emailBouncedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "resumedAt" TIMESTAMP(3),
    "askDismissedAt" TIMESTAMP(3),
    "askCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderPreference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "targetId" TEXT,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "engagedAt" TIMESTAMP(3),
    "ignoredAt" TIMESTAMP(3),
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "toEmail" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "devBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobLease" (
    "name" TEXT NOT NULL,
    "holder" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),
    "lastResult" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLease_pkey" PRIMARY KEY ("name")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "ReminderDelivery_userId_kind_periodKey_key" ON "ReminderDelivery"("userId", "kind", "periodKey");
CREATE INDEX IF NOT EXISTS "ReminderDelivery_userId_status_sentAt_idx" ON "ReminderDelivery"("userId", "status", "sentAt");
CREATE INDEX IF NOT EXISTS "ReminderDelivery_status_deadline_idx" ON "ReminderDelivery"("status", "deadline");
CREATE INDEX IF NOT EXISTS "ReminderDelivery_createdAt_idx" ON "ReminderDelivery"("createdAt");

-- Per-address and global daily e-mail budgets, and the 30-day retention.
CREATE INDEX IF NOT EXISTS "EmailMessage_toEmail_kind_createdAt_idx" ON "EmailMessage"("toEmail", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_kind_createdAt_idx" ON "EmailMessage"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReminderPreference_userId_fkey') THEN
    ALTER TABLE "ReminderPreference" ADD CONSTRAINT "ReminderPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReminderDelivery_userId_fkey') THEN
    ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailMessage_userId_fkey') THEN
    ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
