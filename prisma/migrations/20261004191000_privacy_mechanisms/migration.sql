-- B4 · Privacy / LGPD mechanisms (A-008 / A-049 / A-050 / A-054).
-- Additive only; safe to re-run.

-- A-049 (age attestation), A-008 (versioned health-data consent), A-054
-- (accepted policy version). All nullable: existing rows were never asked, and
-- are caught by the Today re-acknowledge notice (acknowledgedPolicyVersion NULL
-- != POLICY_VERSION).
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "confirmedAdultAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "healthDataConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "healthDataConsentVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "acknowledgedPolicyVersion" TEXT;

-- A-050 · the LGPD art. 18 data-subject request channel (public page). Enums
-- are created only if absent so the migration is re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataRequestKind') THEN
    CREATE TYPE "DataRequestKind" AS ENUM ('ACCESS', 'DELETE', 'CORRECT', 'PORTABILITY', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataRequestStatus') THEN
    CREATE TYPE "DataRequestStatus" AS ENUM ('OPEN', 'RESOLVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DataRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "kind" "DataRequestKind" NOT NULL DEFAULT 'ACCESS',
  "message" TEXT,
  "status" "DataRequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DataRequest_userId_fkey') THEN
    ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DataRequest_status_createdAt_idx" ON "DataRequest" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "DataRequest_userId_idx" ON "DataRequest" ("userId");
