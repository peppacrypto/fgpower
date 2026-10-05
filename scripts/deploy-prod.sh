#!/usr/bin/env bash
# FGPOWER — deploy to Railway prod + reseed the database.
# Deploys the linked `web` service, waits for it to go live, then reseeds
# so new programs, evidence and catalog changes land in the production DB.
#
# Run it yourself from the Claude prompt with:  ! bash scripts/deploy-prod.sh
set -euo pipefail

PROJECT=a56b8bf1-4c39-4e6a-8ff8-2d7e649829cf
WEB=65ac4abe-4fd4-46f1-a151-b02977abbaa6
ENVID=b8409383-32bd-4b51-927e-2b2c2b0b2ba1

cd "$(dirname "$0")/.."

# --- Safety: only ever ship a clean, already-pushed main --------------------
# `railway up` uploads the working directory, so an uncommitted or unpushed
# edit would go live unreviewed. Refuse unless HEAD is clean and == origin/main.
git fetch --quiet origin main
if [ -n "$(git status --porcelain)" ]; then
  echo "ABORT: working tree is dirty — commit or stash before deploying." >&2
  exit 1
fi
HEAD_SHA=$(git rev-parse HEAD)
ORIGIN_SHA=$(git rev-parse origin/main)
if [ "$HEAD_SHA" != "$ORIGIN_SHA" ]; then
  echo "ABORT: HEAD ($HEAD_SHA) != origin/main ($ORIGIN_SHA) — push to main first." >&2
  exit 1
fi
SHORT_SHA=$(git rev-parse --short HEAD)

# --- Credentials: use the account token, not the project token --------------
# tokens.env defines RAILWAY_TOKEN (a project token); when it is set the CLI
# prefers it and `railway up` fails with "Not signed in". Drop it and keep only
# RAILWAY_API_TOKEN (the account token the CLI needs to upload a build).
set -a; source ~/.config/secrets/tokens.env; set +a
unset RAILWAY_TOKEN
export RAILWAY_API_TOKEN

# --- Gate: the build must typecheck and pass unit tests ---------------------
echo "==> Typechecking…"
npm run typecheck
echo "==> Running tests…"
npm run test

# --- Record which commit is live (surfaced at /api/health) ------------------
echo "==> Tagging the live build as $SHORT_SHA…"
npx -y @railway/cli@latest variable set "BUILD_SHA=$SHORT_SHA" \
  -p "$PROJECT" -s "$WEB" -e "$ENVID" --skip-deploys

# Pre-migration safety net (A-004): snapshot the DB *before* `railway up`
# triggers the preDeploy `prisma migrate deploy`. Fails closed — if the backup
# cannot be taken, we do not deploy. Set FG_SKIP_BACKUP=1 to override (e.g. a
# code-only redeploy with no pending migrations and no reseed).
if [ -z "${FG_SKIP_BACKUP:-}" ]; then
  echo "==> Pre-deploy safety backup…"
  bash "$(dirname "$0")/backup-prod.sh" pre-deploy
else
  echo "==> FG_SKIP_BACKUP set — skipping pre-deploy backup."
fi

echo "==> Deploying web service to Railway prod (this builds on Railway; ~2-4 min)…"
npx -y @railway/cli@latest up --ci -p "$PROJECT" -s "$WEB" -e "$ENVID"

echo "==> Reseeding production database (programs, evidence, catalog)…"
ssh railway-web -- "npx tsx prisma/seed.ts"

echo "==> Done. Live at https://fgpower.monster (build $SHORT_SHA)"
