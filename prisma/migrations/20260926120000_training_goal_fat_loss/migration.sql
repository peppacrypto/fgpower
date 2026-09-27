-- "Emagrecer / definir" as an onboarding goal. Programs map it to general
-- fitness; the UI is honest that diet drives fat loss and training keeps muscle.
ALTER TYPE "TrainingGoal" ADD VALUE IF NOT EXISTS 'FAT_LOSS';
