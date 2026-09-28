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

### 1. Weekly volume per muscle

**Constants:** `LOW_WEEKLY_SETS_THRESHOLD = 4`, `HIGH_WEEKLY_SETS_THRESHOLD = 28`,
`SECONDARY_SET_CREDIT = 0.5`.

When the program's exercises carry muscle-level data (the app always passes it), volume is
judged **per muscle**, never summed across a coarse group such as "legs":

- **High:** more than 28 **direct** sets/week for one muscle (sets of exercises where it is
  a primary mover) → flagged as high-end volume that may be hard to recover from.
- **Low:** under 4 **fractional** sets/week for a muscle that has direct work — direct sets
  plus half of every set in which it is a secondary mover → flagged as possibly low if
  hypertrophy of that muscle is a priority. Counting synergist sets at half credit keeps a
  muscle trained mostly through compounds (e.g. glutes via squats and hinges plus a few
  hip-thrust sets) from being called under-trained.

Legacy callers that only pass muscle *groups* keep the original behavior: direct sets
summed per group against the same thresholds.

**Evidence basis:** a systematic review/meta-regression of 15 studies found each
additional weekly set associated with a small increase in hypertrophy (a "graded, not
sharply stepped" dose-response); a systematic review of trained young men found no
significant difference in quadriceps/biceps growth between 12–20 vs. >20 weekly sets,
suggesting returns flatten somewhere in that range for many muscles; the largest
dose-response meta-regression to date (Pelland et al., 67 studies) found growth rising
with weekly sets per muscle along a diminishing-returns curve, with data sparse above
about 25 sets, and found that counting indirect sets as half a set predicted outcomes
better than counting them as zero or as full sets — which is why the low-volume check uses
fractional sets. FGPOWER's thresholds are set conservatively inside the range this
literature actually supports (see `training-volume` on `/app/science` for full
citations) — they are a sanity check, not a claimed optimum.

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

## Motivation: what keeps people training, and what we never do

FGPOWER's habit features follow the same brand as the programs: they must never push
someone to train while fatigued, reward junk volume, or nag. These are product rules
(approved 2026-09-27), not heuristics — a change needs the owner's sign-off.

### What the app does

- **Weekly streak, never a daily one** (`src/lib/training/streak.ts` `weeklyStreak`, the
  only streak rule; rows built by `src/lib/data/streak-weeks.ts` for Today and the workout
  summary alike). A week counts when its target was met — the program's week (its days
  with exercises, or its frequency when it repeats days), capped at the days left in a
  Thursday–Sunday entry week; the profile's days per week without a program. A planned
  **deload week counts with any workout** in it (the week's guidance says so). **One missed
  week is forgiven per 8 weeks of streak**, so a sick week or a trip doesn't erase months.
  Rest days never "break" anything.
- **Neutral progress copy.** Today shows "4 SEMANAS SEGUIDAS · RECORDE 6" and, from
  Thursday, "Faltam 2 treinos para manter a sequência" — only when the count fits the days
  left at the plan's spacing and is 2 at most (`src/app/app/today/streak-nudge.ts`: a number
  that takes back-to-back sessions to reach would push cramming), and "para esta semana
  contar" when a free week would cover a miss. Nothing is shown when there is no streak.
- **Rest is part of the plan.** After a workout, or on a day that isn't one of the user's
  training days while the week is on track, Today says "Descanso hoje — próximo: Sessão B
  na segunda", with an outline "Treinar mesmo assim" (`upcomingWorkout` in
  `src/lib/training/day-rotation.ts`). A user who is behind is offered today, never pushed
  into doubling up after a workout already done today. A new week never repeats the session
  just trained: after the plan's first day, or any workout the day before the new week (a
  Sunday catch-up), it continues the sequence by default (`weekStartChoice`).
- **Welcome back, not "you missed".** From 10 days without training Today suggests
  starting at ~90% of the loads with one more rep in reserve, linking the deload science.
- **The program's week is visible** (`src/lib/training/week-guidance.ts`): "SEMANA 5 DE 13 ·
  RIR ALVO 1" with the week's instructions on Today and in the workout. Deload and test
  weeks are named as such. The week's RIR **moves** each exercise's own target rather than
  replacing it (`weekRirTarget`): every exercise shifts by the same step — this week's RIR
  minus the program's baseline, the lower median of its non-deload weeks — so the program's
  differences between exercises stay, and the result never goes below the exercise's floor:
  **RIR 1 for anything** (the wave never prescribes failure; "last set to failure" stays in
  the week's instructions), **RIR 2 for free-weight compounds** ("pesos livres nunca à
  falha"), or the exercise's own "mín. RIR N" note — unless the program itself asks for
  less. Lighter weeks raise targets to RIR 4 at most; timed holds keep their own. GD 1's
  week 5 (RIR 1, baseline 2): bench 3 → 2, machine compounds 2.5 → 1.5, isolations 2 → 1 —
  what the week's note prescribes. The workout's advice and the summary's "Na próxima"
  judge the sets by that same target (`getSessionRirTargets`).
- **Records are rare and real** (`src/lib/training/personal-records-core.ts`): a first time
  is a baseline, never a record; load, estimated 1RM (≤ 10 reps) and reps at a load already
  used — never session volume. The workout marks a set that beats one with a square "PR"
  and a 30 ms vibration, by the same rules.
- **Milestones are sparse and private**: the 10th/25th/50th/100th workout and a completed
  block. They are never posted anywhere unless the user shares them.
- **A fresh start each Monday**: on Monday and Tuesday Today closes out last week (workouts
  of the target, streak, records dated by their workout, sets per muscle judged as §1 judges
  them — low under 4 fractional sets where the muscle has direct work, high over 28 direct
  sets — and the new week's note), dismissible for the week.
- **"Por quê?" links** go from every nudge to the science behind it.

### What the app never does

- No daily streaks, no "don't break the chain" pressure on rest days.
- No loss-aversion or guilt copy ("você vai perder…", "não desista", countdowns to losing
  a streak, red warnings on missed days).
- No leaderboards, no tonnage/volume badges, no badge walls, no rewards for extra sets.
- No auto-posting to the feed: activities are private unless the user shares them.
- Reminders (a later batch) at most **1 a day and 3 a week**, and **never on rest or deload
  days**.
