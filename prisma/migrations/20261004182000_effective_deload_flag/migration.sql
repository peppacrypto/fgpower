-- A-017 / A-005 / A-019 · one deload signal for planned + applied.
--
-- WorkoutSession.isDeload was written only for *applied* deloads (openSessionForDay).
-- advanceProgram now also stamps it for a *planned* deload week (week-guidance
-- isDeloadGuidance) at finish. This backfills finished history so a planned deload
-- already in the past is excluded as a load reference (getPreviousPerformances), skipped
-- by the block report (anchorLifts), and read as a deload in its summary — matching the
-- forward code. Applied deloads (already true) are left alone; nothing is ever cleared.
--
-- Mirrors src/lib/training/week-guidance.ts isDeloadGuidance against the program week each
-- finished session counts as (block-progress countedWeeks: programWeek minus 1 for a
-- trained Thursday–Sunday entry week). CONSERVATIVE on purpose — a false positive would
-- wrongly hide a normal week as a reference, so this flags only weeks whose guidance
-- *states* a deload, never one that merely mentions a possible one, and never "não é
-- (deload|descarga)". A false negative is harmless (one more cycle before history lines
-- up; the forward stamp still fixes every new session).

WITH entry AS (
  SELECT e.id,
    -- isPartialEntryWeek: São Paulo weekday of the activation is Sun(0) or Thu–Sat(4–6).
    (EXTRACT(DOW FROM ((e."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')) IN (0, 4, 5, 6)) AS partial,
    -- entryWeekEnd: the Monday after the activation's São Paulo calendar week.
    (date_trunc('week', ((e."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')) + interval '7 days') AS entry_end
  FROM "ProgramEnrollment" e
), enr AS (
  SELECT en.id,
    (en.partial AND EXISTS (
      SELECT 1 FROM "WorkoutSession" w
      WHERE w."enrollmentId" = en.id AND w.status = 'COMPLETED'
        AND ((w."finishedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo') < en.entry_end
    )) AS entry_trained
  FROM entry en
), target AS (
  SELECT ws.id AS session_id,
    GREATEST(1, ws."programWeek" - CASE WHEN enr.entry_trained THEN 1 ELSE 0 END) AS guidance_week,
    p."weeklyGuidance" AS guidance
  FROM "WorkoutSession" ws
  JOIN "ProgramEnrollment" e ON e.id = ws."enrollmentId"
  JOIN enr ON enr.id = e.id
  JOIN "UserProgram" p ON p.id = ws."programId"
  WHERE ws.status = 'COMPLETED'
    AND NOT ws."isDeload"
    AND ws."programWeek" IS NOT NULL
    AND p."weeklyGuidance" IS NOT NULL
    AND jsonb_typeof(p."weeklyGuidance") = 'array'
), note AS (
  SELECT tg.session_id,
    COALESCE(g.elem->>'notePt', '') AS note_pt,
    COALESCE(g.elem->>'setsNotePt', '') AS sets_pt
  FROM target tg
  CROSS JOIN LATERAL jsonb_array_elements(tg.guidance) AS g(elem)
  WHERE g.elem->>'week' ~ '^[0-9]+$' AND (g.elem->>'week')::int = tg.guidance_week
), flagged AS (
  SELECT session_id
  FROM note
  WHERE
    -- never a "não é deload/descarga" week (NOT_A_DELOAD)
    note_pt !~* 'n[ãa]o[[:space:]]+[ée][[:space:]]+(deload|descarga)'
    AND sets_pt !~* 'n[ãa]o[[:space:]]+[ée][[:space:]]+(deload|descarga)'
    AND (
      -- P1: a sentence that OPENS with deload/descarga, not a conditional one
      -- ("…: deload agora", "deload se …"). Each note is tested on its own so a
      -- conditional in one note never suppresses a real statement in the other.
      ( sets_pt ~* '(^|[.:;][[:space:]]*)(deload|descarga)([^[:alnum:]]|$)'
        AND sets_pt !~* '(^|[.:;][[:space:]]*)(deload|descarga)[[:space:]]+(se|caso|quando|agora)' )
      OR ( note_pt ~* '(^|[.:;][[:space:]]*)(deload|descarga)([^[:alnum:]]|$)'
        AND note_pt !~* '(^|[.:;][[:space:]]*)(deload|descarga)[[:space:]]+(se|caso|quando|agora)' )
      -- P2: "semana [única|leve] [de] deload/descarga" (e.g. "Semana de descarga:")
      OR (note_pt || ' ' || sets_pt) ~* 'semana[[:space:]]+([úu]nica[[:space:]]+|leve[[:space:]]+)?(de[[:space:]]+)?(deload|descarga)'
      -- P3/P4/P5/P6
      OR (note_pt || ' ' || sets_pt) ~* '\(deload\)'
      OR (note_pt || ' ' || sets_pt) ~* 'mini-?descarga'
      OR (note_pt || ' ' || sets_pt) ~* 'semana[[:space:]]+leve[[:space:]]+planejada'
      OR (note_pt || ' ' || sets_pt) ~* 'semana[[:space:]]+de[[:space:]]+consolida[çc][ãa]o[[:space:]]*:[[:space:]]*(reduza|corte)'
    )
)
UPDATE "WorkoutSession" ws
SET "isDeload" = true
FROM flagged f
WHERE ws.id = f.session_id;
