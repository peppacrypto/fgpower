# Dependency security advisories — accepted (dev/CLI-only)

Reviewed 2026-10-05 (B8 / A-098). `npm audit fix` (non-breaking) was applied and clears
`brace-expansion` (high) and `fast-uri` (moderate). The advisories below remain because their
only available fix is a **major downgrade**, and they are confined to dev/CLI tooling that never
runs in the deployed Node server. They are accepted, not force-fixed.

## Prisma CLI chain — accepted
- Packages: `prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2` (transitive, high).
- Advisories: DeepmergeTS recursive-merge stack exhaustion; MySQL2 auth-plugin downgrade / zlib
  decompression-bomb DoS.
- Why accepted: the only `npm audit` fix is `prisma@6.19.3` (a major downgrade from 7.x). The app's
  RUNTIME uses `@prisma/client` + `@prisma/adapter-pg` + `pg` against Postgres; `mysql2` ships only
  inside the Prisma CLI and is never loaded by the server. The advisories are reachable only from the
  developer CLI (`prisma migrate`/`generate`/`db seed`), not from request handling.
- Revisit: when Prisma publishes a 7.x release whose dependency tree drops these, bump forward.

## Next.js ESLint chain — accepted
- Packages: `eslint-config-next`, `@next/eslint-plugin-next`, `braces`, `fast-glob`, `micromatch`
  (transitive, high).
- Advisory: `braces`/`micromatch` ReDoS / stack exhaustion on crafted glob patterns.
- Why accepted: the only `npm audit` fix is `eslint-config-next@14.2.35` (a major downgrade); the
  package must stay pinned `~16.3.8` to match Next 16. These run only in `eslint` during local dev /
  CI linting over first-party source — no untrusted glob input, no production exposure.
- Revisit: when `eslint-config-next@16.x` ships an updated `micromatch`/`braces`, bump forward.
