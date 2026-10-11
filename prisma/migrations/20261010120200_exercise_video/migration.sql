-- Optional tutorial video on an exercise (currently yoga poses): a YouTube URL
-- plus its channel attribution. Additive, nullable — no existing row changes.
-- A dedicated field (not ExerciseMedia) keeps every thumbnail query image-only.
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "videoCredit" TEXT;
