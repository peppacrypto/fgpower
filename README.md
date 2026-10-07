# FGPOWER

**Train with a reason.**

FGPOWER is a science-first strength-training platform: build or choose an
evidence-informed workout program, know exactly how and why to execute every exercise,
train with a purpose-built mobile execution mode, and watch your progression accumulate
automatically over months and years — plus a training-focused social layer to share it
with people who train too.

FGPOWER is not a demo. It is a complete, deployed, database-backed application: real
Google authentication, a real PostgreSQL schema, a real exercise catalog (876 exercises),
190 independently DOI-verified scientific citations, a fully functional custom workout
builder, a mobile-first training screen with a rest timer and automatic progressive-
overload suggestions, permanent training history with charts, and a follow/feed/FG social
layer — all covered by unit, integration, and end-to-end tests.

## The four pillars

1. **Programming** — build your own program from a full exercise library, or start from
   an evidence-informed ready-made template and fork it as your own.
2. **Execution** — every exercise explains exactly how to perform it and *why it's
   there*, with real citations, not marketing copy.
3. **Progression** — every set, rep, and load you log is permanent. FGPOWER remembers
   your last performance so you never have to, and tells you — transparently — when a
   real progression is available.
4. **Community** — follow other lifters, share a workout (you control exactly what's
   visible), and give **FGs** — FGPOWER's own reaction, native to real training data.

## Live

- **Production:** https://fgpower.monster — the deployed commit's short SHA is readable at
  `/api/health` (the `sha` field).
- **GitHub:** `peppacrypto/fgpower`

## Features

- Sign-in with Google OAuth or — when e-mail is configured (off in production until Resend
  exists) — a passwordless e-mail code / magic link (better-auth), with a step-by-step
  onboarding flow
- Full exercise library (876 exercises) — searchable, filterable by muscle/equipment/
  movement pattern, accent-insensitive search (pt-BR + en)
- Rich exercise detail pages: setup, breathing, coaching cues, common mistakes, range of
  motion, scientific rationale with real citations and evidence levels (259 exercises
  fully curated; the rest carry base instructions/muscle/equipment data)
- Program library of 59 evidence-informed programs — the flagship **FGPOWER Adaptation**
  plus 58 curated templates across hypertrophy, strength, general fitness and sports
  performance, the multi-block **GD** progression series, and a 9-program mobility track —
  each with a full scientific rationale, weekly progression guidance, and cited sources
- Custom workout builder: drag-and-drop exercise reordering (`@dnd-kit`), per-exercise
  sets/reps/RIR/rest/warm-up configuration, multi-day programs, duplicate/fork/archive
- Deterministic "smart program feedback" — volume, session-size, movement-duplication,
  and consecutive-lower-body-day heuristics (see `docs/PROGRAMMING_RULES.md`)
- Mobile-first workout execution mode: one-handed rapid set entry, previous-performance
  recall, automatic rest timer, warm-up/working/drop sets, add/remove/skip, persistent
  per-exercise notes ("seat position 4")
- Deterministic progressive-overload engine (double progression, linear load, RIR-based,
  repetition-based, or manual) with transparent, shown reasoning — never auto-changes a
  load without the user confirming
- Personal records (max weight, rep PR at a given weight, estimated 1RM, session volume),
  computed automatically at the end of every workout
- Training calendar, full session history, per-exercise progression charts (custom SVG)
- Progress overview with period filters, consistency %, and exercise-by-exercise deltas
- Profile, settings (privacy controls, public username), data export (JSON), account
  deletion (better-auth, with fresh-session enforcement)
- Social layer: follow/unfollow with private-account follow requests, a feed, FGs (give/
  remove, one per user per activity, never on your own), notifications, blocking,
  reporting — all authorization-checked server-side (see `src/lib/social/authorization.ts`)
- Admin panel (role- or email-gated): exercise content curation, evidence linking, report
  moderation
- PWA-installable, dark-first design system with a light-mode fallback, WCAG-AA-minded
  contrast and focus states
- Opt-in training reminders over Web Push (capped at 1/day and 3/week, never on rest or
  deload days) and an unsubscribable weekly e-mail digest (Resend)
- Body-weight logging with a trend chart, folded into the progress views

## Architecture

```
Browser ──▶ Next.js 16 (App Router, Server Components + Server Actions)
                │
                ├── better-auth (Google OAuth, sessions, admin role)
                │
                └── Prisma 7 (driver adapter) ──▶ PostgreSQL
```

- Almost every mutation is a **Server Action** (`src/lib/actions/*.ts`) — no separate
  REST/GraphQL layer for app-internal calls. The 18 real HTTP routes handle what a Server
  Action can't: better-auth's catch-all, the health check, account data export (needs a
  file-download response), the mobile execution client's workout endpoints (autosave, sets,
  exercises, notes, technique), exercise search, the notifications poll, Web-Push
  subscriptions, e-mail unsubscribe and the Resend webhook, the reminders cron, the
  share-link redirect (`/r/[token]`), and dev-only test endpoints (login/outbox/reminders)
  disabled in production.
- **Data access** is centralized in `src/lib/data/*.ts` (read queries) and
  `src/lib/actions/*.ts` (writes), never inlined ad hoc in a page — every read that
  crosses a user boundary goes through an explicit ownership or authorization check.
- **Pure business logic** (1RM estimation, volume, progressive overload, programming
  rules) lives in `src/lib/training/` and `src/lib/programming/` with zero framework
  dependency, so it's unit-testable in isolation (`*.test.ts` next to each module).

## Tech stack

Verified against official docs/registries on 2026-09-08 — see the inline comments in
`src/lib/auth/auth.ts`, `prisma.config.ts`, and `next.config.ts` for version-specific
notes.

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.8 (App Router, Turbopack, React 19.2) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL |
| ORM | Prisma 7.10 (`@prisma/adapter-pg` driver adapter) — pinned below Prisma 8 (RC) |
| Auth | better-auth 1.7 (Google OAuth + admin role + username field) |
| Validation | Zod 4 |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Charts | Custom SVG components (no chart library) |
| Transactional e-mail | Resend REST API (login codes, weekly digest) |
| Push notifications | Web Push (`web-push`, VAPID) |
| Unit/integration tests | Vitest |
| E2E tests | Playwright |
| Deployment | Railway (Railpack build, no Dockerfile) |

## Project structure

```
prisma/
  schema.prisma          — full relational schema (auth, catalog, evidence, programs,
                            training log, social layer)
  seed.ts                 — idempotent seed (taxonomy → exercises → evidence →
                             principles → curated content → flagship program)
  seed-data/               — hand-authored + generated seed content
scripts/
  process-exercise-images.mjs  — DO NOT RUN, kept as documented history (see
                                  docs/DATA_SOURCES.md)
  build-exercise-catalog.mjs   — merges free-exercise-db + pt-BR translations + taxonomy
src/
  app/
    (marketing)/           — landing, privacy, terms
    login/, onboarding/    — auth entry + onboarding wizard
    app/                   — the authenticated product (today, programs, exercises,
                              workout execution, history, progress, profile, settings,
                              feed, notifications, discover, activity)
    admin/                 — admin-only panel
    u/[username]/          — public profile
    api/                   — better-auth handler, health check, account data export,
                              workout execution endpoints, exercise search, notifications
                              poll, push subscriptions, e-mail unsubscribe + Resend
                              webhook, reminders cron, share redirect, dev-only test
                              endpoints
  components/               — UI primitives, nav, brand, exercise/social components
  lib/
    auth/, data/, actions/  — auth config, read queries, write mutations
    training/               — 1RM, volume, progressive overload (pure, unit-tested)
    programming/             — smart program feedback rules (pure, unit-tested)
    social/                  — authorization + moderation helpers (integration-tested)
    email/, push/, reminders/ — Resend e-mail, Web Push, reminder scheduling
    validation/               — Zod schemas
e2e/                        — Playwright specs
docs/                       — this repo's required documentation set
```

## Local setup

Prerequisites: Node.js ≥ 22, a PostgreSQL instance (or Docker).

```bash
git clone <repo-url> fgpower && cd fgpower
npm install                     # runs `prisma generate` via postinstall
cp .env.example .env            # then fill in DATABASE_URL at minimum

# start a local Postgres if you don't have one:
docker run -d --name fgpower-postgres \
  -e POSTGRES_USER=fgpower -e POSTGRES_PASSWORD=fgpower -e POSTGRES_DB=fgpower \
  -p 5433:5432 postgres:16-alpine

npx prisma migrate dev          # applies the schema
# only to regenerate the exercise seed data (exits 1 without --source; keeps the file's hand
# fixes unless --overwrite, which rebuilds it from the source alone):
# node scripts/build-exercise-catalog.mjs --source <free-exercise-db checkout> [--translations <dir>] [--overwrite]
npx tsx prisma/seed.ts          # seeds taxonomy, exercises, evidence, principles, program

npm run dev                     # http://localhost:3000
```

## Environment variables

See `.env.example` for the full annotated list. At minimum for local dev:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | random 32+ byte secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | public origin, no trailing slash |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (see below if unset) |
| `ADMIN_EMAILS` | comma-separated emails granted admin access on sign-in |

**If Google OAuth credentials are not yet configured:** the app still builds, deploys,
and runs fully — the login page shows a clear "not configured" message instead of a
broken button, and `NODE_ENV !== "production"` additionally enables a password-based
test account (never available in production) so development and E2E tests aren't
blocked. The exact authorized redirect URI to register in Google Cloud Console is:

```
${BETTER_AUTH_URL}/api/auth/callback/google
```

## Database

Prisma 7 with the `@prisma/adapter-pg` driver adapter; the datasource URL lives in
`prisma.config.ts` (read from `DATABASE_URL`), not in `schema.prisma` itself (Prisma 7
convention). Migrations: `npx prisma migrate dev` locally, `npx prisma migrate deploy` in
production (wired as Railway's pre-deploy command). Seeding is fully idempotent — safe to
re-run any time; every seed function upserts on a stable key (slug/id).

## Exercise dataset attribution & scientific evidence methodology

See **`docs/DATA_SOURCES.md`** (full license audit, including the licensing situation
around the bundled exercise photography the app ships and the project owner's decision to
include it) and **`docs/SCIENCE_METHOD.md`** (evidence hierarchy, citation verification
process, how uncertainty is handled). Deterministic programming heuristics are documented
separately in **`docs/PROGRAMMING_RULES.md`**.

## Testing

```bash
npm run typecheck    # next typegen + tsc --noEmit
npm run lint         # eslint
npm test             # vitest — pure-logic unit tests + Postgres-backed integration tests
npm run test:e2e     # playwright (see "Running the E2E suite" below)
npm run build        # production build
```

- **Unit tests** — pure functions with no DB/network dependency: 1RM estimation, volume,
  the progressive-overload engine, every smart-program-feedback rule, program scheduling,
  streaks, the Zod validation schemas, and assorted UI/formatting helpers.
- **Integration tests** (`*.integration.test.ts`) — run against a **real local Postgres**:
  the authorization logic gating every activity/profile read (private accounts,
  follower-only content, blocking), the moderation/report lifecycle, the LGPD data-subject
  flows (export, account deletion, data requests), e-mail and Web-Push delivery, and the
  workout write paths. They need `DATABASE_URL` pointed at a reachable Postgres (the Docker
  container from **Local setup** is enough). `npm test` runs both suites — 160+ test files
  in total.
- **E2E tests** (`e2e/*.spec.ts`) — full user journeys: landing → login, onboarding,
  choosing and starting a program, workout execution (start → log a set → finish), history
  and progress, building and saving a custom program, the exercise library/detail and
  science pages, the social inbox/feed/profile, sharing, reminders, and e-mail login. Auth
  is bootstrapped via a dev-only `/api/test/login` route (disabled in production; see
  `e2e/fixtures.ts`).
- **E2E database** — the DB-backed specs talk to the local Postgres two ways, both built on
  `DATABASE_URL` in `e2e/db.ts`: a shared async `pool` for typed reads, and a synchronous
  `sql()` that runs `psql` inside the `fgpower-postgres` container (override with
  `E2E_PG_CONTAINER`). A Playwright `globalSetup` (`e2e/global-setup.ts`) proves both paths
  reach the same database before any test runs, so a stopped container fails the run loudly
  instead of silently skipping the streak, lifecycle and today-nav specs.

### Running the E2E suite

`playwright.config.ts` supports two modes:

- **Let Playwright start the server (default):** just run `npm run test:e2e`. Playwright
  starts its own `next dev` on **port 3055** and reuses one already listening there
  (`reuseExistingServer`). You do **not** need to run `npm run dev` yourself — and if you
  do, it listens on 3000, so the two never collide. (Starting a *second* `next dev` in the
  same directory is exactly what Next 16 refuses with "Another next dev server is already
  running"; the dedicated 3055 port sidesteps that.) A reachable Postgres (`DATABASE_URL`)
  must be up, because the dev server needs it.
- **Against an already-running server:** set `E2E_BASE_URL` to its origin, e.g.
  `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`, or build and start a production
  server (`npm run build && npm run start`) and point `E2E_BASE_URL` at it. When
  `E2E_BASE_URL` is set, Playwright starts no server of its own and talks only to that
  origin.

**Never point `E2E_BASE_URL` at production.** The specs sign in through the dev-only
`/api/test/login` route (disabled when `NODE_ENV=production`) and create and delete real
data (workouts, programs, follows, reports); against the live deployment they would fail on
the missing test route and, where they didn't, would corrupt real users' data.

## Deployment

Deployed on **Railway** via **Railpack** (auto-detected Next.js build/start — no
Dockerfile). `next.config.ts` deliberately does not set `output: "standalone"`;
`package.json`'s `start` script is `next start --port ${PORT:-3000}` so Railway's
injected `PORT` is respected without the standalone build's manual asset-copy step.
Database migrations run via Railway's `preDeployCommand` (`npx prisma migrate deploy`),
which executes in a separate step with full access to service environment variables and
the private network, before the new container starts.

Railway's classic `railway.json`/`railway.toml` config-as-code is being sunset
(2026-12-01) and new services can no longer opt into it — FGPOWER's service settings
(build/start/health-check/pre-deploy) are configured directly via the Railway API/CLI
instead of a committed config file.

**Rollback is not safe for 95e3c69 and later** — those releases run irreversible
`ALTER TYPE … ADD VALUE` migrations and carry the Batch-5 security sweep, so an
older image boots but fails on live data and silently reopens fixed holes. Roll
forward instead; see `docs/RELEASE_SAFETY.md` for the runbook and the
expand/contract policy for future enum values.

### Deploy runbook

Deploy **only** via `scripts/deploy-prod.sh` — do not run `railway up` by hand.
The script refuses to deploy unless the working tree is clean and `HEAD` equals
`origin/main`, unsets the project `RAILWAY_TOKEN` (otherwise the CLI fails with
"Not signed in"), runs `npm run typecheck` and `npm run test`, tags the live
build with the short commit SHA (readable at `/api/health` as `sha`), deploys the
`web` service, and then **reseeds the production database** — the reseed
(`ssh railway-web -- "npx tsx prisma/seed.ts"`) is mandatory, because new programs,
evidence and catalog content only reach prod through it. Seeding is idempotent.

Run it from the Claude prompt with: `! bash scripts/deploy-prod.sh`

### Backups & disaster recovery

The production database holds users' permanent training history, so every deploy
carries a **pre-migration safety net**: `scripts/deploy-prod.sh` runs
`scripts/backup-prod.sh` before `railway up` (and therefore before the preDeploy
`prisma migrate deploy`), taking a compressed `pg_dump -Fc` from inside the Postgres
container to a git-ignored local directory. It fails closed — no backup, no deploy
(override with `FG_SKIP_BACKUP=1` for a code-only redeploy). Retention, an ad-hoc
backup, and the restore-drill procedure are documented in
**`docs/BACKUP_RESTORE.md`**. Platform-level scheduled backups/PITR should also be
enabled and confirmed in the Railway dashboard (owner-managed — see the Owner
checklist in that runbook) as a second, off-workstation line of defence.

## License notes

FGPOWER's own code has no license file committed (all rights reserved by default) —
add one explicitly if/when the project's licensing intent is decided. Third-party data
is used strictly under the terms documented in `docs/DATA_SOURCES.md`; nothing in this
repository is redistributed under a license inconsistent with its source.
