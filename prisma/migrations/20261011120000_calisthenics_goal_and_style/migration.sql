-- Calisthenics as an additive modality: full bodyweight-strength programs stay
-- primary (they keep a strength goal), and a complementary "skills" track holds
-- the skill-progression routines (pull-up / handstand / planche / front-lever /
-- pistol). New enum values only: no existing row changes, no column drops.
-- CALISTHENICS_SKILL is a template goal (its own complementary track); CALISTHENICS
-- is the training style shared by the primary and skill calisthenics programs.
-- Neither is an onboarding goal.
ALTER TYPE "TrainingGoal" ADD VALUE IF NOT EXISTS 'CALISTHENICS_SKILL';
ALTER TYPE "TrainingStyle" ADD VALUE IF NOT EXISTS 'CALISTHENICS';
