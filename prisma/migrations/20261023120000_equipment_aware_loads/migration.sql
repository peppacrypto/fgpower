-- Equipment-aware loads ("Minha academia").
--
-- The progression used one "Salto de carga" (Profile.loadIncrementKg, 2,5 kg)
-- for every exercise, so it suggested dumbbells and stack plates that don't
-- exist (12 → 14,5 kg). Loads now follow the equipment: the gym's dumbbell rack
-- spacing, one plate of a machine's / a cable's stack, the lightest plate and
-- the kettlebell gap, each with the most common Brazilian gym as the default —
-- plus the gear the gym doesn't have (missingGear) and an exercise's own step
-- (ExerciseLoadStep, "Este aparelho sobe de…").
--
-- Additive only: new columns with defaults, a new table; loadIncrementKg is
-- kept (an older image still reads it). No enum change (A-038).

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "cableStepKg" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "dumbbellScheme" TEXT NOT NULL DEFAULT '1-10-2',
ADD COLUMN     "kettlebellStepKg" DOUBLE PRECISION NOT NULL DEFAULT 4,
ADD COLUMN     "missingGear" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "smallestPlateKg" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
ADD COLUMN     "stackStepKg" DOUBLE PRECISION NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "ExerciseLoadStep" (
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "stepKg" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLoadStep_pkey" PRIMARY KEY ("userId","exerciseId")
);

-- AddForeignKey
ALTER TABLE "ExerciseLoadStep" ADD CONSTRAINT "ExerciseLoadStep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLoadStep" ADD CONSTRAINT "ExerciseLoadStep_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
