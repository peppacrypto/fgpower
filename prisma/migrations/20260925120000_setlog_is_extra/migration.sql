-- Mark sets the user added beyond the prescription ("série extra").
ALTER TABLE "SetLog" ADD COLUMN "isExtra" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: until now extra sets were plain WORKING rows appended after the
-- prescribed ones, so any WORKING row past the log's prescribedSets (in
-- setNumber order) was an extra.
UPDATE "SetLog" s
SET "isExtra" = true
FROM (
  SELECT sl.id,
         ROW_NUMBER() OVER (PARTITION BY sl."exerciseLogId" ORDER BY sl."setNumber", sl."createdAt") AS ord,
         el."prescribedSets" AS prescribed
  FROM "SetLog" sl
  JOIN "WorkoutExerciseLog" el ON el.id = sl."exerciseLogId"
  WHERE sl."setType" = 'WORKING'
) ranked
WHERE s.id = ranked.id AND ranked.ord > ranked.prescribed;
