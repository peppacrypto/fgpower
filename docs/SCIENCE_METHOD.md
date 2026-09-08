# Science Method

FGPOWER's core differentiator is that its training guidance is grounded in real,
verifiable evidence rather than fitness-industry folklore. This document explains how
that evidence was selected, how it is presented, and where its limits are.

## Evidence hierarchy

FGPOWER prioritizes evidence roughly in this order, following standard sports-science
practice:

1. **Consensus statements / major professional guidelines** (ACSM, NSCA, WHO position
   stands) — evidence level **A**
2. **Systematic reviews and meta-analyses** — level **A** or **B** depending on the
   strength/consistency of the pooled evidence
3. **Randomized controlled trials** — level **B**
4. **Controlled intervention studies** (non-randomized, or single-condition designs) —
   level **B**
5. **Biomechanical / EMG studies** — level **C**
6. **Observational studies** — level **C**
7. **Expert consensus / narrative reviews**, used only when stronger evidence does not
   yet exist for a given question — level **D**

These levels are stored on every `EvidenceSource` row (`evidenceLevel: A | B | C | D`)
and shown next to every citation in the product — on exercise pages, training-principle
pages, and program pages — never hidden in fine print.

## Where citations come from

Every one of the 148 sources currently in FGPOWER's database was:

1. **Identified** by topic (e.g. "rest interval hypertrophy," "squat depth quadriceps
   hypertrophy") using a real literature search, prioritizing meta-analyses and
   guidelines over single studies where both exist.
2. **Verified to actually exist** against the **Crossref API** (DOI resolution — title,
   year, journal, and first author cross-checked against what Crossref itself returns)
   and, where indexed, the **PubMed API** (via NCBI E-utilities).
3. **Read**, not just cited by title — the abstract was fetched and used to write a
   faithful summary of what the study actually found, including its limitations, sample
   size, and population, not just its headline conclusion.
4. **Adversarially re-verified** by a second, independent pass that re-resolved the DOI
   from scratch, compared it against the first pass's claimed metadata, and rewrote the
   summary if it was inaccurate or overclaiming in any way. Zero sources were accepted
   without this second, independent confirmation.

No source in FGPOWER's database was invented, approximated, or "vibes-based." If a
citation could not be verified against Crossref/PubMed, it was discarded rather than
included with reduced confidence.

## Why EMG alone does not crown a "best" exercise

Electromyography (EMG) measures electrical activity in a muscle during a contraction —
it is a genuinely useful biomechanical signal, but it is **not** a direct measurement of
long-term hypertrophy or strength outcomes. Two exercises can show different EMG
amplitude for a given muscle without producing different long-term growth once volume
and effort are equated, and EMG cannot capture connective-tissue loading, injury risk,
or how sustainable an exercise is across a real training week. FGPOWER treats EMG/
biomechanical studies as level-**C** evidence — informative about *how* a muscle is
being loaded, but weaker than a controlled training trial that actually measured
strength or muscle-size change over weeks.

Consequently, exercise pages never claim an exercise is "the best" or "scientifically
proven superior" based on activation data alone. Where FGPOWER cites biomechanical
evidence for an exercise, the language is deliberately about *mechanism* ("this loads
the muscle at a longer length," "this maintains constant tension through midrange"), not
superiority claims the underlying study doesn't support.

## How exercise biomechanics evidence differs from training-outcome evidence

- **Biomechanical/EMG evidence** answers: *what is this exercise mechanically doing* —
  which muscle is under greatest tension, at what joint angle, at what point in the
  range of motion?
- **Training-outcome evidence** (RCTs measuring muscle thickness, strength, or
  cross-sectional area over weeks/months) answers: *does training this way actually
  produce more muscle or strength than the alternative?*

A biomechanical finding is a plausible *mechanism* for a training-outcome effect, but it
is not proof that the effect exists at the scale of real adaptation. FGPOWER's
`EvidenceSource.evidenceType` field distinguishes these explicitly (`biomechanical` /
`emg` vs. `rct` / `controlled_trial` / `meta_analysis`), and exercise pages that cite
only mechanistic evidence say so rather than implying a training-outcome guarantee.

## How uncertainty is handled

Sports science is an active, evolving field with real disagreement between studies —
FGPOWER's training-principle pages (see `/app/science`) are written to reflect that
honestly:

- Effect sizes, confidence intervals, and sample sizes are described in plain language
  when they materially affect how confident a claim should be (e.g. "a small,
  borderline-significant advantage," "the evidence base is still modest — 15 studies").
- When two studies on the same question disagree, or a meta-analysis explicitly flags a
  non-significant trend alongside a significant pooled estimate, both are stated rather
  than only the more favorable-sounding one.
- Absolute claims like "proven" or "guaranteed" are avoided throughout the product. The
  standard phrasing is "the evidence suggests," "found," or "associated with" — matching
  what the underlying study actually supports.
- Every exercise's science section carries the same disclaimer: *"Evidence describes
  training principles and biomechanics. It does not imply that this exercise is uniquely
  superior to every alternative."*

## How templates are constructed

FGPOWER's flagship program (FGPOWER Adaptation — see `docs/PROGRAMMING_RULES.md` for the
deterministic rules that check any program, including this one) was built by:

1. Starting from well-established, guideline-level principles (progressive overload,
   the ACSM position stand on program design for different training statuses).
2. Applying more specific, better-supported findings for each programming variable
   (volume, frequency, rest, rep range, RIR/proximity-to-failure) — each with its own
   cited sources, visible on the program's detail page and on `/app/science`.
3. Never inventing a rationale after the fact — every prescriptive choice in the
   template (2x/week lower body, 3x/week distributed upper body, RIR 1–3 defaults, a
   4-week adaptation ramp for beginners) is directly traceable to a specific cited
   finding in its rationale text.

## Citation requirements for any future content

Anyone (human or automated) extending FGPOWER's exercise or program content must:

- Never write a scientific claim without a specific, real, DOI-verifiable source behind
  it.
- Verify the source against Crossref (and PubMed where applicable) before citing it —
  title, authors, year, and journal must actually match.
- Read the abstract (not just the title) before summarizing what it found.
- Assign an honest `evidenceLevel` based on the study design, not the strength of the
  claim being made.
- Prefer meta-analyses and guidelines over single studies where both exist for the same
  question.
- Flag genuine uncertainty in the summary rather than smoothing it over.
