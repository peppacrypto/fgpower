-- Batch 5 · supersets (W-104). Data only; safe to re-run (it only fills
-- groupKey where there is none).
--
-- The GD blocks prescribe 23 supersets in their notes ("Superset com …" on two
-- adjacent rows, ~20 s on the first, ~2 min after the pair). They become real
-- groups (groupKey "A", one pair per day):
--
-- 1. The template rows. programs.generated.json carries the same keys, which
--    the post-deploy reseed writes again; this covers activations between the
--    deploy and the reseed (forks copy groupKey). Each row is matched by
--    template slug, day index, sortOrder AND exercise slug, and a pair is
--    written only when both of its rows match — so content that moved since
--    is left alone rather than half-grouped.
WITH pair(slug, day, first_sort, first_slug, second_sort, second_slug, key) AS (VALUES
    ('gd-1', 1, 3, 'face-pull', 4, 'standing-calf-raises', 'A'),
    ('gd-1', 4, 5, 'side-lateral-raise', 6, 'calf-press-on-the-leg-press-machine', 'A'),
    ('gd-2', 1, 4, 'cable-rear-delt-fly', 5, 'standing-calf-raises', 'A'),
    ('gd-2', 2, 5, 'seated-triceps-press', 6, 'incline-dumbbell-curl', 'A'),
    ('gd-3', 0, 3, 'side-lateral-raise', 4, 'cable-rope-overhead-triceps-extension', 'A'),
    ('gd-3', 2, 4, 'standing-calf-raises', 5, 'cable-seated-lateral-raise', 'A'),
    ('gd-3', 3, 4, 'cable-hammer-curls-rope-attachment', 5, 'ez-bar-skullcrusher', 'A'),
    ('gd-3', 4, 5, 'calf-press-on-the-leg-press-machine', 6, 'side-lateral-raise', 'A'),
    ('gd-4', 0, 6, 'side-lateral-raise', 7, 'cable-rope-overhead-triceps-extension', 'A'),
    ('gd-4', 1, 4, 'standing-calf-raises', 5, 'cable-rear-delt-fly', 'A'),
    ('gd-4', 4, 6, 'calf-press-on-the-leg-press-machine', 7, 'side-lateral-raise', 'A'),
    ('gd-5', 2, 4, 'standing-low-pulley-one-arm-triceps-extension', 5, 'incline-dumbbell-curl', 'A'),
    ('gd-5', 4, 3, 'preacher-curl', 4, 'cable-rope-overhead-triceps-extension', 'A'),
    ('gd-6', 0, 5, 'face-pull', 6, 'triceps-pushdown-v-bar-attachment', 'A'),
    ('gd-6', 1, 4, 'standing-calf-raises', 5, 'hanging-leg-raise', 'A'),
    ('gd-6', 4, 5, 'standing-calf-raises', 6, 'side-lateral-raise', 'A'),
    ('gd-7', 0, 3, 'cable-crossover', 4, 'cable-rope-overhead-triceps-extension', 'A'),
    ('gd-7', 2, 4, 'standing-calf-raises', 5, 'cable-seated-lateral-raise', 'A'),
    ('gd-7', 3, 4, 'preacher-curl', 5, 'ez-bar-skullcrusher', 'A'),
    ('gd-7', 4, 4, 'calf-press-on-the-leg-press-machine', 5, 'side-lateral-raise', 'A'),
    ('gd-8', 0, 4, 'cable-rope-overhead-triceps-extension', 5, 'side-lateral-raise', 'A'),
    ('gd-8', 1, 3, 'face-pull', 4, 'standing-calf-raises', 'A'),
    ('gd-8', 4, 5, 'side-lateral-raise', 6, 'calf-press-on-the-leg-press-machine', 'A')
),
found AS (
  SELECT a.id AS first_id, b.id AS second_id, pair.key
  FROM pair
  JOIN "WorkoutTemplate" t ON t.slug = pair.slug
  JOIN "WorkoutTemplateDay" d ON d."templateId" = t.id AND d."dayIndex" = pair.day
  JOIN "WorkoutTemplateExercise" a ON a."dayId" = d.id AND a."sortOrder" = pair.first_sort AND a."groupKey" IS NULL
  JOIN "Exercise" ax ON ax.id = a."exerciseId" AND ax.slug = pair.first_slug
  JOIN "WorkoutTemplateExercise" b ON b."dayId" = d.id AND b."sortOrder" = pair.second_sort AND b."groupKey" IS NULL
  JOIN "Exercise" bx ON bx.id = b."exerciseId" AND bx.slug = pair.second_slug
  -- the day has no group of its own yet
  WHERE NOT EXISTS (SELECT 1 FROM "WorkoutTemplateExercise" g WHERE g."dayId" = d.id AND g."groupKey" IS NOT NULL)
)
UPDATE "WorkoutTemplateExercise" e
SET "groupKey" = f.key
FROM found f
WHERE e.id = f.first_id OR e.id = f.second_id;

-- 2. Programs already copied from a GD template: the rows that still carry the
--    superset note on BOTH adjacent rows (an adapted row reads "No lugar de X.
--    Superset com …"; a row the user swapped via "Usar no programa" lost its
--    note and is left alone), with no group yet on that day. Workouts already
--    open keep their snapshot and get groups from the next session.
WITH cand AS (
  SELECT e.id, e."dayId", e."sortOrder"
  FROM "UserProgramExercise" e
  JOIN "UserProgramDay" d ON d.id = e."dayId"
  JOIN "UserProgram" p ON p.id = d."programId"
  JOIN "WorkoutTemplate" t ON t.id = p."sourceTemplateId"
  WHERE t.slug LIKE 'gd-%'
    AND e."groupKey" IS NULL
    AND e.notes ~ '(^|\. )Superset com '
),
pairs AS (
  SELECT a.id AS first_id, b.id AS second_id, a."dayId", a."sortOrder"
  FROM cand a
  JOIN cand b ON b."dayId" = a."dayId" AND b."sortOrder" = a."sortOrder" + 1
  -- exactly two in a row: never glue a third row onto a pair
  WHERE NOT EXISTS (SELECT 1 FROM cand c WHERE c."dayId" = a."dayId" AND c."sortOrder" = a."sortOrder" - 1)
    AND NOT EXISTS (SELECT 1 FROM cand c WHERE c."dayId" = a."dayId" AND c."sortOrder" = a."sortOrder" + 2)
    -- the day has no group of its own yet (letters start at A)
    AND NOT EXISTS (SELECT 1 FROM "UserProgramExercise" g WHERE g."dayId" = a."dayId" AND g."groupKey" IS NOT NULL)
),
lettered AS (
  SELECT first_id, second_id,
         chr(64 + (row_number() OVER (PARTITION BY "dayId" ORDER BY "sortOrder"))::int) AS letter
  FROM pairs
)
UPDATE "UserProgramExercise" u
SET "groupKey" = l.letter
FROM lettered l
WHERE u.id = l.first_id OR u.id = l.second_id;
