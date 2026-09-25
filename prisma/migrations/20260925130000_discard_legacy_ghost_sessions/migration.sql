-- The old start action created a fresh copy of a program day on every tap, so
-- users were left with blank IN_PROGRESS copies that kept Today stuck on
-- "Treino em andamento" pointing at an empty workout (it looked as if the real,
-- finished workout had been lost). Discard open sessions with nothing logged.
-- Only the status changes; rows are kept. The age guard spares a session
-- someone opened moments before this deploy — unless it is a blank copy of a
-- day that had already been finished, which is exactly the ghost.
UPDATE "WorkoutSession" w
SET status = 'DISCARDED', "updatedAt" = now()
WHERE w.status = 'IN_PROGRESS'
  AND NOT EXISTS (
    SELECT 1 FROM "SetLog" s
    WHERE s."sessionId" = w.id
      AND (s."isCompleted" OR s."weightKg" IS NOT NULL OR s.reps IS NOT NULL)
  )
  AND (
    w."startedAt" < now() - interval '6 hours'
    OR EXISTS (
      SELECT 1 FROM "WorkoutSession" d
      WHERE d."userId" = w."userId"
        AND d.status = 'COMPLETED'
        AND d."totalWorkingSets" > 0
        AND d."programId" = w."programId"
        AND d.name = w.name
        -- The same training occasion: opened while the real one was running
        -- (double tap) or right after it was finished.
        AND d."finishedAt" >= w."startedAt" - interval '12 hours'
    )
  );

-- Blank copies that were then "finished": the old finish accepted a session
-- with no working set, which showed as a "0 séries" workout in history and
-- hid the last real loads. The new finish refuses these (EMPTY).
UPDATE "WorkoutSession" w
SET status = 'DISCARDED', "updatedAt" = now()
WHERE w.status = 'COMPLETED'
  AND w."totalWorkingSets" = 0
  AND NOT EXISTS (
    SELECT 1 FROM "SetLog" s
    WHERE s."sessionId" = w.id AND s."isCompleted" AND s."setType" <> 'WARMUP'
  )
  -- A shared post stays reachable (and deletable) from history.
  AND NOT EXISTS (SELECT 1 FROM "Activity" a WHERE a."sessionId" = w.id);
