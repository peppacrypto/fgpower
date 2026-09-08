#!/usr/bin/env bash
# FGPOWER — deploy to Railway prod + reseed the database.
# Deploys the linked `web` service, waits for it to go live, then reseeds
# so the 30 new programs land in the production DB.
#
# Run it yourself from the Claude prompt with:  ! bash scripts/deploy-prod.sh
set -euo pipefail

PROJECT=a56b8bf1-4c39-4e6a-8ff8-2d7e649829cf
WEB=65ac4abe-4fd4-46f1-a151-b02977abbaa6
ENVID=b8409383-32bd-4b51-927e-2b2c2b0b2ba1

cd "$(dirname "$0")/.."
set -a; source ~/.config/secrets/tokens.env; set +a
export RAILWAY_API_TOKEN

echo "==> Deploying web service to Railway prod (this builds on Railway; ~2-4 min)…"
npx -y @railway/cli@latest up --ci -s "$WEB" -e "$ENVID"

echo "==> Reseeding production database (30 new programs)…"
ssh railway-web -- "npx tsx prisma/seed.ts"

echo "==> Done. Live at https://fgpower.monster"
