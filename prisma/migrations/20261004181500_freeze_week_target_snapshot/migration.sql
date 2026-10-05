-- A-001: freeze the weekly streak / block "N de M treinos" against program edits.
-- Each finished workout now carries the week's plan as trained
-- ({ daysPerWeek, trainableDays, dayCount }); the streak and block-progress read
-- it for past weeks so editing the program (add/duplicate a day, raise the
-- frequency, remove or empty a day) never rewrites a week already trained.
-- Additive: one nullable column, no drops.

-- 1. The column (Prisma `Json?` → JSONB, like daySnapshot).
ALTER TABLE "WorkoutSession" ADD COLUMN "weekTargetSnapshot" JSONB;

-- 2. Freeze current history: stamp every enrolled session with its program's
--    CURRENT structure. Today's displayed history is already computed from that
--    structure, so nothing shifts on apply — but from now on edits leave past
--    weeks untouched. (History rewritten by edits made BEFORE this migration
--    cannot be recovered; it was never stored.)
UPDATE "WorkoutSession" ws
SET "weekTargetSnapshot" = jsonb_build_object(
  'daysPerWeek', p."daysPerWeek",
  'trainableDays', COALESCE(t.cnt, 0),
  'dayCount', COALESCE(d.cnt, 0)
)
FROM "ProgramEnrollment" e
JOIN "UserProgram" p ON p."id" = e."programId"
LEFT JOIN (
  SELECT "programId", COUNT(*)::int AS cnt
  FROM "UserProgramDay"
  GROUP BY "programId"
) d ON d."programId" = p."id"
LEFT JOIN (
  SELECT upd."programId", COUNT(*)::int AS cnt
  FROM "UserProgramDay" upd
  WHERE EXISTS (SELECT 1 FROM "UserProgramExercise" upe WHERE upe."dayId" = upd."id")
  GROUP BY upd."programId"
) t ON t."programId" = p."id"
WHERE ws."enrollmentId" = e."id"
  AND ws."weekTargetSnapshot" IS NULL;
