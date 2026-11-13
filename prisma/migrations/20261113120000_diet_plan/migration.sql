-- Dieta (2026-11-13): the user's eating plan and, per São Paulo day, which of
-- its items were eaten and which alternative filled each. Health data, owner-
-- only. Additive: two new tables, nothing else changes. Both cascade with the
-- account (LGPD erasure); each FK is backed by a unique index that leads with it.

-- CreateTable
CREATE TABLE "DietPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT,
    "goal" TEXT,
    "kcal" INTEGER NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION,
    "meals" JSONB NOT NULL,
    "swaps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "choiceId" TEXT,
    "eaten" BOOLEAN NOT NULL,
    "meal" TEXT NOT NULL,
    "food" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one plan per user (the active one).
CREATE UNIQUE INDEX "DietPlan_userId_key" ON "DietPlan"("userId");

-- CreateIndex: one row per item and day.
CREATE UNIQUE INDEX "DietLog_userId_day_itemId_key" ON "DietLog"("userId", "day", "itemId");

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietLog" ADD CONSTRAINT "DietLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
