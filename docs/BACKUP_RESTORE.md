# Backup & disaster recovery runbook

The production Postgres database (`fgpower`, Railway project
`a56b8bf1-4c39-4e6a-8ff8-2d7e649829cf`, env `production`, Postgres service
`823d6fd2-87d8-4195-9f81-540cd5033f1b`) holds every user's permanent training
history. Its `DATABASE_URL` is private-only (`postgres.railway.internal`, no public
proxy), so all backup/restore work runs *inside* a Railway container via
`railway ssh`.

## Two lines of defence

1. **In-repo, off-platform dumps** — `scripts/backup-prod.sh` (below). Runs
   automatically before every deploy and can be run on demand.
2. **Platform backups** — Railway scheduled volume backups + PITR, enabled in the
   Railway dashboard. These live off this workstation and survive its loss.
   **Owner-managed** — see "Owner checklist".

## Taking a backup

```bash
# Ad-hoc, labelled snapshot:
! bash scripts/backup-prod.sh manual

# Automatic, labelled "pre-deploy", fired by scripts/deploy-prod.sh before every
# `railway up` (fail-closed; skip with FG_SKIP_BACKUP=1 for code-only redeploys).
```

Snapshots are written to `$HOME/fgpower-backups` (override `FG_BACKUP_DIR`) as
`fgpower-<UTC-timestamp>-<label>.dump` in `pg_dump -Fc` custom format. They are
**not** committed (`.gitignore`).

## Retention

The script keeps the newest `FG_BACKUP_KEEP` snapshots (default **14**) and prunes
the rest on each run. With roughly one deploy-triggered dump per release plus manual
dumps, 14 covers the recent working window. For longer history, copy periodic
snapshots off this machine (e.g. monthly) — the Railway platform backups are the
long-horizon/off-site tier.

## Restore drill (run quarterly, and after any backup-tooling change)

Restores verify the dumps are real. Drill into a **scratch** database — never prod.

```bash
# 1. Start the local dev Postgres (docker container `fgpower-postgres`, port 5433).
docker start fgpower-postgres

# 2. Create a throwaway scratch DB.
docker exec -i fgpower-postgres psql -U postgres -c 'DROP DATABASE IF EXISTS fgpower_restore_drill;'
docker exec -i fgpower-postgres psql -U postgres -c 'CREATE DATABASE fgpower_restore_drill;'

# 3. Restore the newest dump into it (pg_restore lives in the container).
latest="$(ls -1t "$HOME/fgpower-backups"/fgpower-*.dump | head -1)"
docker exec -i fgpower-postgres pg_restore --no-owner --no-privileges \
  -U postgres -d fgpower_restore_drill < "$latest"

# 4. Sanity-check row counts against prod expectations.
docker exec -i fgpower-postgres psql -U postgres -d fgpower_restore_drill \
  -c 'SELECT count(*) AS users FROM "user";' \
  -c 'SELECT count(*) AS sessions FROM "WorkoutSession";' \
  -c 'SELECT count(*) AS exercises FROM "Exercise";'

# 5. Tear down.
docker exec -i fgpower-postgres psql -U postgres -c 'DROP DATABASE fgpower_restore_drill;'
```

A clean `pg_restore` with no errors and non-zero counts = the backup is restorable.
Record the date and the dump restored in the deploy/handoff notes.

## Restoring production (real incident)

1. Take a fresh `scripts/backup-prod.sh incident` snapshot of the *current* broken
   state first (never destroy evidence).
2. Identify the good dump to restore.
3. Put the app into maintenance (scale `web` to 0 in the Railway dashboard) so no
   writes race the restore.
4. Restore inside the Postgres container, e.g. stream the dump in over
   `railway ssh -s <postgres> -- sh -c 'pg_restore --clean --if-exists --no-owner
   --no-privileges -d "$DATABASE_URL"'`. For a volume-loss scenario, provision a
   fresh Postgres service and restore into it, then repoint `DATABASE_URL`.
5. Bring `web` back up and verify.

## Owner checklist (cannot be done from the repo)

- [ ] Confirm/enable **Railway scheduled backups** (daily + weekly) on the Postgres
      service, and note the retention the plan allows.
- [ ] Confirm PITR availability on the current plan.
- [ ] Run the restore drill above once now, and quarterly thereafter; record it.
