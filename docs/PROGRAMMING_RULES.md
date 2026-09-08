# Programming Rules

FGPOWER's "smart program feedback" (spec §12) is a set of **deterministic heuristics**,
not an AI/LLM call. Every rule lives in `src/lib/programming/rules.ts`
(`analyzeProgram()`), is unit-tested (`src/lib/programming/rules.test.ts`), and runs
against any program — the flagship template, a customized fork, or a fully custom
program — via `src/lib/programming/analyze.ts`.

None of these rules are a hard block. Every message shown to the user is framed, and
literally suffixed in the UI, as *"guidance, not a prohibition"* — the user can always
proceed regardless.

## Rules and their thresholds

### 1. Weekly volume per muscle group

**Constants:** `LOW_WEEKLY_SETS_THRESHOLD = 4`, `HIGH_WEEKLY_SETS_THRESHOLD = 28`.

For each muscle group, FGPOWER sums the prescribed sets of every exercise whose
*primary* muscle falls in that group, across every day in the program (one week's worth
of training).

- **Below 4 sets/week** for a group that has any direct work at all → flagged as
  possibly low for someone prioritizing hypertrophy of that muscle.
- **Above 28 sets/week** → flagged as high-end volume that may be hard to recover from.

**Evidence basis:** a systematic review/meta-regression of 15 studies found each
additional weekly set associated with a small increase in hypertrophy (a "graded, not
sharply stepped" dose-response); a systematic review of trained young men found no
significant difference in quadriceps/biceps growth between 12–20 vs. >20 weekly sets,
suggesting returns flatten somewhere in that range for many muscles; a larger, more
recent meta-regression found both hypertrophy and strength increase with volume but with
clearly diminishing returns at higher counts. FGPOWER's thresholds are set conservatively
inside the range this literature actually supports (see `training-volume` on
`/app/science` for full citations) — they are a sanity check, not a claimed optimum.

### 2. Total working sets per session

**Constant:** `HIGH_SESSION_WORKING_SETS_THRESHOLD = 30`.

If a single day's total prescribed working sets (summed across every exercise) exceeds
30, FGPOWER flags that the session may be difficult to recover from in one sitting —
matching the spec's own worked example ("this workout contains 31 working sets").

### 3. Duplicate / very similar movement patterns

**Constant:** `SIMILAR_MOVEMENT_MIN_COUNT = 3`.

If a single day contains 3 or more exercises sharing the same `movementPattern` (e.g.
three separate horizontal-push variants), FGPOWER flags the redundancy and names the
specific exercises involved, so the user can judge whether that's intentional
specialization or accidental duplication.

### 4. Consecutive lower-body-heavy sessions

**Constant:** `LOWER_BODY_HEAVY_SET_THRESHOLD = 3`.

A day is considered "lower-body heavy" if its `LEGS`/`GLUTES`-primary exercises sum to 3
or more sets. If two such days are scheduled on **consecutive** program days (by
`dayIndex`), FGPOWER flags that heavy lower-body stress is scheduled back-to-back with no
day of lighter lower-body work between them.

### 5. No horizontal pulling movement

If a program includes at least one pulling movement (`horizontal-pull` or
`vertical-pull` in its `movementPattern`) but **none** of them are `horizontal-pull`
specifically (i.e., the only pulling is lat pulldowns/pull-ups with no rowing movement),
FGPOWER flags the missing horizontal-pull pattern — matching the spec's worked example
verbatim.

## What is deliberately *not* a rule

- **No rule fires purely on exercise *count*.** A day with many light, low-set
  accessory exercises and a day with few, high-set compound exercises are judged on
  actual set volume, not how many rows appear in the builder.
- **No rule compares against another user's program**, and no rule uses any AI model —
  every input is the program's own structure (sets, muscle groups, movement patterns,
  day order), read directly from the database.
- **No rule silently changes anything.** `analyzeProgram()` is pure and read-only; it
  returns a list of `{code, severity, messageEn, messagePt}` objects for the UI to
  render — it never mutates the program.

## Where thresholds could be revisited

These constants are intentionally centralized at the top of `rules.ts` specifically so
they can be tuned as FGPOWER's evidence base grows or as user feedback surfaces false
positives/negatives — they are not meant to be treated as immutable. Any change should
cite the specific evidence (see `docs/SCIENCE_METHOD.md` for the verification process)
that justifies the new number, and should come with an updated/added unit test in
`rules.test.ts` demonstrating the new boundary behavior.

## Progressive overload (a related, separately-documented engine)

The progressive-overload suggestion engine (`src/lib/training/progression.ts`) is
governed by the same "deterministic, never silently mutates" philosophy but answers a
different question — *should this specific exercise's load increase next session* rather
than *is this program's overall structure reasonable*. See the inline documentation in
that file and the `double-progression` / `rir` pages under `/app/science` for its
reasoning; it is unit-tested in `progression.test.ts`.
