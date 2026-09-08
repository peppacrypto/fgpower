# FGPOWER

**Train with a reason.**

FGPOWER is a science-first strength-training platform: build or choose an
evidence-informed workout program, know exactly how and why to execute every exercise,
train with a purpose-built mobile execution mode, and watch your progression accumulate
automatically over months and years — plus a training-focused social layer to share it
with people who train too.

FGPOWER is not a demo. It is a complete, deployed, database-backed application: real
Google authentication, a real PostgreSQL schema, a real exercise catalog (876 exercises),
148 independently DOI-verified scientific citations, a fully functional custom workout
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

- **Production:** see the handoff summary at the end of this session, or `railway
  status` for the current deployment.
- **GitHub:** `peppacrypto/fgpower`

## Features

- Google OAuth sign-in (better-auth), with a step-by-step onboarding flow
- Full exercise library (876 exercises) — searchable, filterable by muscle/equipment/
  movement pattern, accent-insensitive search (pt-BR + en)
- Rich exercise detail pages: setup, breathing, coaching cues, common mistakes, range of
  motion, scientific rationale with real citations and evidence levels (20 flagship
  exercises fully curated; the rest carry base instructions/muscle/equipment data)
- Program library with a flagship evidence-informed program (**FGPOWER Adaptation**),
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
- Training calendar, full session history, per-exercise progression charts (Recharts)
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

## Architecture

```
Browser ──▶ Next.js 16 (App Router, Server Components + Server Actions)
                │
                ├── better-auth (Google OAuth, sessions, admin role)
                │
                └── Prisma 7 (driver adapter) ──▶ PostgreSQL
```

- Almost every mutation is a **Server Action** (`src/lib/actions/*.ts`) — no separate
  REST/GraphQL layer for app-internal calls. A handful of real HTTP routes exist where
  needed: better-auth's catch-all, health check, data export (needs a download response),
  and a dev-only test-login endpoint for E2E.
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
| Framework | Next.js 16.3 (App Router, Turbopack, React 19.2) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL |
| ORM | Prisma 7.10 (`@prisma/adapter-pg` driver adapter) — pinned below Prisma 8 (RC) |
| Auth | better-auth 1.7 (Google OAuth + admin role + username field) |
| Validation | Zod 4 |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Charts | Recharts |
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
    api/                   — better-auth handler, health check, data export, dev-only
                              test-login
  components/               — UI primitives, nav, brand, exercise/social components
  lib/
    auth/, data/, actions/  — auth config, read queries, write mutations
    training/               — 1RM, volume, progressive overload (pure, unit-tested)
    programming/             — smart program feedback rules (pure, unit-tested)
    social/                  — authorization helpers (integration-tested)
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
node scripts/build-exercise-catalog.mjs   # only needed if regenerating exercise seed data
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
npm run test:e2e     # playwright — requires the dev server (npm run dev) or a running deployment
npm run build        # production build
```

- **Unit tests** (`src/lib/training/*.test.ts`, `src/lib/programming/rules.test.ts`) —
  1RM estimation, volume calculations, the progressive-overload engine, and every smart-
  program-feedback rule, all pure functions with no DB/network dependency.
- **Integration tests** (`src/lib/social/authorization.integration.test.ts`) — the
  authorization logic gating every activity/profile read (private accounts, follower-only
  content, blocking) against a real local Postgres.
- **E2E tests** (`e2e/*.spec.ts`) — landing → login, onboarding, choosing and starting a
  program, full workout execution (start → log a set → finish), history, building and
  saving a custom program, exercise library/detail, science pages. Auth is bootstrapped
  via a dev-only `/api/test/login` route (disabled in production; see
  `e2e/fixtures.ts`).

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

## License notes

FGPOWER's own code has no license file committed (all rights reserved by default) —
add one explicitly if/when the project's licensing intent is decided. Third-party data
is used strictly under the terms documented in `docs/DATA_SOURCES.md`; nothing in this
repository is redistributed under a license inconsistent with its source.
