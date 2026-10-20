-- Follow-up to 20260925130000: that cleanup kept every empty finished session
-- that had an Activity row, taking it for a shared post. But the old summary's
-- "Salvar" made a PRIVATE card with no link, for the owner alone, and history
-- never lists a session with no working set, so nothing reachable depended on
-- it. Such a session still counted as a workout ("Treino nº", the profile's
-- workout count, the 10/25/50/100 stamps) and its "0 séries" card stayed in
-- the owner's feed. Drop that card, then discard the session as the first
-- cleanup did (status only; its rows are kept). A card that was ever shown to
-- anyone else (visibility other than PRIVATE, or a link) stays, as before.
DELETE FROM "Activity" a
USING "WorkoutSession" w
WHERE a."sessionId" = w.id
  AND a.visibility = 'PRIVATE'
  AND a."shareToken" IS NULL
  AND w.status = 'COMPLETED'
  AND COALESCE(w."totalWorkingSets", 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM "SetLog" s
    WHERE s."sessionId" = w.id AND s."isCompleted" AND s."setType" <> 'WARMUP'
  );

UPDATE "WorkoutSession" w
SET status = 'DISCARDED', "updatedAt" = now()
WHERE w.status = 'COMPLETED'
  AND COALESCE(w."totalWorkingSets", 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM "SetLog" s
    WHERE s."sessionId" = w.id AND s."isCompleted" AND s."setType" <> 'WARMUP'
  )
  AND NOT EXISTS (SELECT 1 FROM "Activity" a WHERE a."sessionId" = w.id);

-- The 10/25/50/100 stamps were numbered with those sessions counted, so a
-- stamp could sit on the workout before the one that is that number now —
-- whose summary draws the same "Dossiê nº" live. Move each workout-count
-- stamp, and its achievements-log row, to the workout that has its number.
WITH numbered AS (
  SELECT w.id, w."userId", w.name, w."finishedAt", w."totalWorkingSets",
    row_number() OVER (PARTITION BY w."userId" ORDER BY w."finishedAt", w.id) AS n
  FROM "WorkoutSession" w
  WHERE w.status = 'COMPLETED' AND w."totalWorkingSets" > 0 AND w."finishedAt" IS NOT NULL
)
UPDATE "Activity" a
SET summary = a.summary || jsonb_build_object(
    'sessionId', r.id,
    'workoutName', 'Dossiê nº ' || (a.summary->>'count') || ' · ' || r.name,
    'totalWorkingSets', r."totalWorkingSets"
  ),
  "createdAt" = r."finishedAt",
  "updatedAt" = now()
FROM numbered r
WHERE a.type = 'MILESTONE'
  AND a.summary->>'kind' = 'WORKOUT_COUNT'
  AND r."userId" = a."userId"
  AND r.n = (a.summary->>'count')::int
  AND a.summary->>'sessionId' IS DISTINCT FROM r.id;

WITH numbered AS (
  SELECT w.id, w."userId", w."finishedAt",
    row_number() OVER (PARTITION BY w."userId" ORDER BY w."finishedAt", w.id) AS n
  FROM "WorkoutSession" w
  WHERE w.status = 'COMPLETED' AND w."totalWorkingSets" > 0 AND w."finishedAt" IS NOT NULL
)
UPDATE "Notification" x
SET "sessionId" = r.id,
  data = COALESCE(x.data, '{}'::jsonb) || jsonb_build_object('sessionId', r.id),
  "createdAt" = r."finishedAt"
FROM numbered r
WHERE x.type = 'WORKOUT_MILESTONE'
  AND x."recipientId" = r."userId"
  AND x."dedupeKey" = 'milestone:' || r.n
  AND x."sessionId" IS DISTINCT FROM r.id;

-- The old finish had also added each empty session to its program's workout
-- count, and neither cleanup took it back. Count those programs' workouts
-- again the way deleting a workout does (rollBackProgram): finished, with a
-- working set. Only programs that had an empty finished session discarded.
UPDATE "ProgramEnrollment" e
SET "completedSessions" = (
    SELECT count(*)::int FROM "WorkoutSession" w
    WHERE w."enrollmentId" = e.id
      AND w."userId" = e."userId"
      AND w.status = 'COMPLETED'
      AND w."totalWorkingSets" > 0
  ),
  "updatedAt" = now()
WHERE EXISTS (
  SELECT 1 FROM "WorkoutSession" d
  WHERE d."enrollmentId" = e.id
    AND d.status = 'DISCARDED'
    AND d."finishedAt" IS NOT NULL
    AND COALESCE(d."totalWorkingSets", 0) = 0
);
