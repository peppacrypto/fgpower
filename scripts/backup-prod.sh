#!/usr/bin/env bash
# FGPOWER — production database backup (off-platform, compressed pg_dump).
#
# Takes a custom-format (`pg_dump -Fc`) snapshot of the production Postgres
# database and writes it to a local, git-ignored backups directory, verifies
# it, then prunes old snapshots to the documented retention window.
#
# WHY from inside the Postgres container: the production DATABASE_URL points at
# `postgres.railway.internal` (private network, no public proxy), so it is not
# reachable from this workstation, and neither this host nor the `web` image has
# a `pg_dump` binary. `railway ssh` runs pg_dump *inside* the Postgres service
# container — which also guarantees the pg_dump version matches the server. The
# compressed dump comes back over stdout.
#
# Retention policy + restore drill: see docs/BACKUP_RESTORE.md.
#
# Run it yourself from the Claude prompt with:  ! bash scripts/backup-prod.sh
set -euo pipefail

PROJECT=a56b8bf1-4c39-4e6a-8ff8-2d7e649829cf
PG=823d6fd2-87d8-4195-9f81-540cd5033f1b
ENVID=b8409383-32bd-4b51-927e-2b2c2b0b2ba1

# Snapshots live outside the repo tree by default (never committed); override
# with FG_BACKUP_DIR. Retention: keep the newest FG_BACKUP_KEEP snapshots.
BACKUP_DIR="${FG_BACKUP_DIR:-$HOME/fgpower-backups}"
KEEP="${FG_BACKUP_KEEP:-14}"
LABEL="${1:-manual}"

cd "$(dirname "$0")/.."
set -a; source ~/.config/secrets/tokens.env; set +a
# tokens.env also defines RAILWAY_TOKEN (a project token); when it is set the
# Railway CLI prefers it and `railway ssh` fails with "Not signed in", so the
# dump would always fail (and, via the fail-closed deploy hook, block every
# deploy). Drop it and keep only RAILWAY_API_TOKEN. Mirrors scripts/deploy-prod.sh.
unset RAILWAY_TOKEN
export RAILWAY_API_TOKEN

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/fgpower-${stamp}-${LABEL}.dump"

echo "==> Dumping production DB from the Postgres container (pg_dump -Fc)…"
# `sh -c` so the container shell expands its own $DATABASE_URL (railway ssh
# execs argv; it does not expand local variables). --no-owner/--no-privileges
# keep the dump portable into a scratch role for restore drills.
npx -y @railway/cli@latest ssh -p "$PROJECT" -e "$ENVID" -s "$PG" -- \
  sh -c 'pg_dump -Fc --no-owner --no-privileges "$DATABASE_URL"' > "$out"

# Integrity check without a local pg_restore: a valid custom-format dump starts
# with the "PGDMP" magic and is never trivially small. The restore drill in
# docs/BACKUP_RESTORE.md does the authoritative pg_restore verification.
magic="$(head -c 5 "$out" 2>/dev/null || true)"
bytes="$(wc -c < "$out" | tr -d ' ')"
if [ "$magic" != "PGDMP" ] || [ "$bytes" -lt 1000 ]; then
  echo "!! Dump failed its integrity check (magic='$magic', ${bytes} bytes). Removing $out" >&2
  rm -f "$out"
  exit 1
fi
echo "==> Wrote $out (${bytes} bytes)"

# Retention: keep the newest $KEEP snapshots, delete the rest.
mapfile -t old < <(ls -1t "$BACKUP_DIR"/fgpower-*.dump 2>/dev/null | tail -n "+$((KEEP + 1))")
if ((${#old[@]})); then
  printf '==> Pruning %d old snapshot(s) beyond the newest %d\n' "${#old[@]}" "$KEEP"
  rm -f "${old[@]}"
fi

echo "==> Backup complete."
