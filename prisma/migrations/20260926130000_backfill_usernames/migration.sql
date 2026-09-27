-- Every account gets a public handle (/u/<username>) so friends can find,
-- open and follow it: before this, onboarding never asked for one and almost
-- no account had one. Data only; touches only users without a username, so
-- re-running it changes nothing.
--
-- Privacy: an account that gets its handle here never chose to be public, so
-- it is also taken out of Descobrir (Profile.discoverable = false) — no search
-- finds it; Perfil tells the user about their new address and links the
-- switch in Settings → Privacidade. Accounts that pick a handle themselves
-- (onboarding, Settings) keep the default, discoverable.
--
-- Mirrors slugifyUsername + usernameCandidate (src/lib/validation/username.ts):
-- the profile display name (else the account name), accents stripped,
-- lowercased, runs of anything else → "_", trimmed to 24; "" → "atleta",
-- under 3 chars → "<name>_fg"; reserved or taken → "maria2", "maria3"…
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
  reserved text[] := ARRAY[
    'admin', 'api', 'app', 'fgpower', 'settings', 'login', 'logout', 'onboarding',
    'programs', 'exercises', 'workout', 'history', 'progress', 'profile', 'feed',
    'u', 'science', 'privacy', 'terms', 'support', 'help', 'root', 'null', 'undefined'
  ];
BEGIN
  UPDATE "Profile" p
  SET discoverable = false
  FROM "user" u
  WHERE u.id = p."userId" AND u.username IS NULL AND p.discoverable;

  FOR r IN
    SELECT u.id, COALESCE(NULLIF(btrim(p."displayName"), ''), u.name, '') AS source
    FROM "user" u
    LEFT JOIN "Profile" p ON p."userId" = u.id
    WHERE u.username IS NULL
    ORDER BY u."createdAt", u.id
  LOOP
    base := lower(translate(
      r.source,
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'
    ));
    base := regexp_replace(base, '[^a-z0-9]+', '_', 'g');
    base := regexp_replace(base, '^_+|_+$', '', 'g');
    base := regexp_replace(left(base, 24), '_+$', '');
    IF base = '' THEN
      base := 'atleta';
    ELSIF length(base) < 3 THEN
      base := base || '_fg';
    END IF;

    n := 1;
    LOOP
      candidate := CASE WHEN n = 1 THEN base ELSE left(base, 24 - length(n::text)) || n::text END;
      EXIT WHEN NOT (candidate = ANY (reserved))
        AND NOT EXISTS (SELECT 1 FROM "user" WHERE username = candidate);
      n := n + 1;
    END LOOP;

    UPDATE "user"
    SET username = candidate, "displayUsername" = candidate
    WHERE id = r.id AND username IS NULL;
  END LOOP;
END $$;
