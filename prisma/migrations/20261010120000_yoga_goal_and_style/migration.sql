-- Yoga programs as a first-class, additive, complementary track.
-- New enum values only: no existing row changes, no column drops. Yoga is a
-- template goal/style (its own library shelf), never an onboarding goal.
-- Kept in its own migration so the new enum values are committed before the
-- next migration (track backfill) references them.
ALTER TYPE "TrainingGoal" ADD VALUE IF NOT EXISTS 'YOGA';
ALTER TYPE "TrainingStyle" ADD VALUE IF NOT EXISTS 'YOGA';
