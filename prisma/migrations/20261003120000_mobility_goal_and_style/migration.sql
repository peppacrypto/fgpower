-- Mobility / flexibility programs as a first-class, additive track.
-- New enum values only: no existing row changes, no column drops. Mobility is a
-- template goal/style (its own library shelf), never an onboarding goal.
ALTER TYPE "TrainingGoal" ADD VALUE IF NOT EXISTS 'MOBILITY';
ALTER TYPE "TrainingStyle" ADD VALUE IF NOT EXISTS 'MOBILITY';
