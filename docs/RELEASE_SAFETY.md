# Release safety & rollback runbook

FGPOWER deploys on Railway. Database migrations run as the service's
`preDeployCommand` (`npx prisma migrate deploy`) in a separate step **before** the
new container starts (see `README.md` → Deployment). That ordering is safe for a
forward deploy, but it is exactly what makes some releases unsafe to roll back:
after the migration runs, the schema is ahead of any older image you might roll
back to.

## Roll-forward only: 95e3c69 and everything after it

**Do not use Railway's "Rollback to previous deploy" to recover from an incident
on 95e3c69 or any later release.** The image boots, `prisma migrate status`
reports "up to date", and then requests fail at runtime — the worst kind of
failure to discover during an incident.

Two independent reasons:

1. **Irreversible enum values.** These migrations run `ALTER TYPE … ADD VALUE`,
   which Postgres cannot reverse and `prisma migrate` has no down step for. Once a
   row carries the new value, an older generated Prisma client throws
   `P2023 "Value '…' not found in enum"` the moment it reads that row:

   | Migration | Enum value | A read that crashes on the old client |
   | --- | --- | --- |
   | `20260926120000_training_goal_fat_loss` | `TrainingGoal.FAT_LOSS` | any template/enrollment read selecting `goal` |
   | `20260929100000_social_core` (Batch 5 / 95e3c69) | `NotificationType.WORKOUT_MILESTONE` | `getNotifications` (`src/lib/data/social/notifications.ts`) |
   | `20261003120000_mobility_goal_and_style` (mobility track) | `TrainingGoal.MOBILITY`, `TrainingStyle.MOBILITY` | any template/enrollment read selecting `goal`/`style` |

   The earliest image that tolerates today's production schema is the mobility
   track (3631d91). Anything older crashes on live data.

2. **Security sweep.** Batch 5 (95e3c69) added per-page `requireAdmin` gates, the
   better-auth route allowlist that closed the `/update-user` hole, and
   banned-user filtering. Rolling back past it silently reopens all three.

## If a release is bad: roll forward, do not roll back

1. **Stop the bleeding without a rollback.** If the regression is a specific
   feature, disable it with the existing env/flag mechanism (e.g.
   `CLEANUP_HIDE_TOKENS`-style hide lists, feature env vars) and redeploy — this
   keeps the current schema and keeps the security fixes.
2. **Fix forward.** Branch from the current `main`, make the correction, and ship
   a new release the normal way: `! bash scripts/deploy-prod.sh` (deploys the
   `web` service and reseeds). Migrations apply via the pre-deploy command as
   usual.
3. **If the bad change was itself a migration**, write a new, additive,
   corrective migration (never edit or delete a migration that has run in prod).
   Enum values cannot be removed — if a value was added in error, stop writing it
   and leave the dead value in place.
4. **Only if forward is impossible and data permits**, a true rollback requires
   first restoring the database to a snapshot from *before* the migration ran
   (Railway Postgres backup), then rolling the image back. Treat this as data
   loss for everything written since the snapshot and get owner sign-off.

## Going forward: expand / contract for enum-like kinds

New enum values are roll-forward-only by the same mechanism above. Before adding
one, prefer a rollback-safe shape:

- **Store open-ended "kind" fields as `TEXT`**, not a Postgres enum, when new
  values are expected over time (notification kinds, goals, styles). An old client
  reads an unknown `TEXT` value without throwing; validate the allowed set in
  application code instead.
- If a real enum is unavoidable, **ship the reader before the writer**: release
  the code that *handles* the new value (and the migration that adds it) first,
  let it bake, and only in a later release start *writing* rows with it. Then the
  intermediate release is a safe rollback target.
- Every new `ALTER TYPE … ADD VALUE` must be added to the registry in
  `src/lib/release-safety.test.ts` and listed in the table above. The test fails
  until both are done — that is the reminder to re-read this runbook and accept
  that the release becomes a new roll-forward-only floor.
