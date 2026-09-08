# Data Sources

FGPOWER's exercise catalog, scientific evidence base, and anatomical taxonomy are built
from external data. This document records exactly what was used, under what license, and
— importantly — what was **evaluated and rejected**, including one significant finding
that changed the shipped product.

All checks below were performed live on **2026-09-08** (GitHub API, npm registry, raw
file fetches, PubMed/Crossref APIs, wger.de live API, Wikimedia Commons API). Where a
source could not be independently corroborated, that is stated explicitly.

---

## 1. Exercise catalog: names, instructions, muscles, equipment

**Source:** [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db)
**License:** Unlicense (public domain dedication), verified via the repo's own
`LICENSE.md` and GitHub API (`license.spdx_id = "Unlicense"`).
**What FGPOWER uses:** exercise names, step-by-step instructions, primary/secondary
muscles, equipment, category, difficulty level, force type, and mechanics (compound vs.
isolation) for all 876 exercises.
**Attribution:** not legally required (public domain), credited here regardless.
**Date checked:** 2026-09-08.

This data is genuinely, unambiguously safe to use commercially — it is a text/JSON
dedication to the public domain, unrestricted.

### ⚠️ Exercise photography — the licensing situation (project owner opted to include)

**Current state:** FGPOWER ships the free-exercise-db photos (resized to WebP under
`public/exercises/<slug>/`, ~39 MB). This is a deliberate decision by the project owner,
made with full knowledge of the licensing caveat documented below — the images add real
visual value to the library and the owner accepts the risk for this project. The caveat
and the cleaner alternatives are kept on record here so the decision can be revisited.



The same repository bundles two JPEG photos per exercise, which FGPOWER processes to
WebP and serves. The licensing chain below is real and worth understanding.

**The finding:** `free-exercise-db`'s images are inherited unmodified from its own
upstream source, [`wrkout/exercises.json`](https://github.com/wrkout/exercises.json).
That repository's own `CONTRIBUTING.md` states, verbatim:

> "these have been scrapped off the internet, therefore l do not own the copy right for
> these images and would advise against using them in comercial projects."

`wrkout`'s README also upsells a paid sibling product (wrkout.xyz) specifically for
"images...videos...which can be used in comercial projects" — further evidence the free
tier's media was never intended for that use. This was independently corroborated by two
unrelated third parties found during the same audit:

1. [Anatome](https://github.com/Rippy1911/anatome)'s own `NOTICE.md` states the same
   dataset's photography is "not cleared for redistribution or commercial use."
2. The pt-BR translator [`gugeldev/exercicios-bd-ptbr`](https://github.com/gugeldev/exercicios-bd-ptbr)
   (see §2 below) deliberately excluded the images from its own CC0 release for the
   identical reason, stating in its README that redistributing them "evita problemas de
   direitos autorais, já que não temos permissão para redistribuí-las."

`free-exercise-db`'s Unlicense dedication covers the JSON/text fields it wrote itself; it
does not — and, per the chain above, legally cannot — retroactively clear photography it
inherited without holding the underlying rights.

**What FGPOWER does today:** it serves these photos (project owner's decision, above).
Exercise cards/detail pages fall back to a `Dumbbell` icon only for the 3 source entries
that have no image at all. `ExerciseMedia` is a first-class model, so swapping to a
cleaner image source later is a data-population task, not a schema change.

**Cleaner alternatives if the photos are ever swapped out**, in order of preference:

- **wger.de's public API** — the cleanest large-scale alternative found. Every
  `/api/v2/exerciseimage/` result carries a per-item `license` id (verified live by
  paginating the full API): of 374 total images, 286 are CC-BY-SA 4.0 and 88 are
  CC-BY-SA 3.0 (both permit commercial use with attribution + share-alike on any
  redistributed derivative). Coverage is partial (374 images across a differently-shaped
  exercise taxonomy than `free-exercise-db`'s 876), so this would need per-exercise
  fuzzy-matching and can't fully replace the catalog, but it is a legitimate way to add
  real, attributable photography for the most common movements.
- **Commission original photography or illustration.** Given the exercise set is fixed
  and finite, and FGPOWER's brand already leans toward a clean, illustrated identity (see
  the FG monogram and design system), custom line-art illustrations of start/end
  positions would also sidestep the licensing question entirely while fitting the
  product's visual language better than stock gym photos.
- **wger's muscle-group SVGs** (see §3) are unrelated to this problem (they're anatomy
  diagrams, not exercise photos) but are a separately-verified clean option worth knowing
  about for a future body-map feature.

---

## 2. Portuguese (pt-BR) exercise names and instructions

**Primary approach used:** FGPOWER generated its own pt-BR translations directly (via a
dedicated background translation pass over all 876 exercise names + instructions),
rather than importing a third-party translation, so quality and terminology consistency
could be controlled end-to-end and the result is FGPOWER's own original text.

**Cross-referenced against:** [`gugeldev/exercicios-bd-ptbr`](https://github.com/gugeldev/exercicios-bd-ptbr)
(formerly `joao-gugel/exercicios-bd-ptbr`) — **CC0 1.0 Universal** (verified via the
repo's own `LICENSE` file and the GitHub API's machine-tagged `license.spdx_id`), a
full pt-BR translation of `free-exercise-db`, confirmed live and actively maintained (192
stars, pushed the same day as this audit). Its README explicitly documents the same
image-provenance problem as §1 and deliberately ships without images for that reason —
independent confirmation of the finding above, and a credible, permissively-licensed
fallback/reference source for terminology if FGPOWER's own translations are ever
revisited.

**Also checked:** wger.de's API `language=pt` field — only 66 of 873 exercises (7.6%)
carry any Portuguese translation, and `pt` is a single generic locale (not
Brazil-specific), so it was not usable as a primary source, though sampled entries read
as correct Brazilian usage.

---

## 3. Muscle-group illustrations (not yet implemented, evaluated for future use)

FGPOWER does not currently ship a body/muscle-map visualization, but the following
permissively-licensed options were verified during this audit for when that feature is
built:

| Source | License | Notes |
|---|---|---|
| [`react-native-body-highlighter`](https://github.com/HichamELBSI/react-native-body-highlighter) | MIT | Original hand-authored SVG muscle-region art; root of the family below. |
| [`react-body-highlighter`](https://github.com/giavinh79/react-body-highlighter) | MIT | Web/React port of the same art. |
| [`body-highlighter`](https://github.com/lahaxearnaud/body-highlighter) | MIT | Framework-agnostic fork, zero runtime deps. |
| wger.de muscle SVGs | CC BY-SA 3.0 | Traced to two specific Wikimedia Commons files; attribution + share-alike required. |
| Wikimedia Commons `Gray512.svg` (Gray's Anatomy, 1918) | Public domain | Zero attribution legally required; needs redrawing into discrete clickable regions. |

Explicitly avoided: `MertenD/musclegroup-image-generator` (non-commercial-only custom
license), MuscleWiki API (proprietary, redistribution forbidden), ExerciseDB/AscendAPI
products (paywalled/commercial).

---

## 4. Scientific evidence sources

148 sources are seeded into the `EvidenceSource` table (see `docs/SCIENCE_METHOD.md` for
the full methodology). Every source is a real, independently verified peer-reviewed
paper or guideline — DOI-resolved against Crossref and cross-checked against PubMed where
indexed — never a fabricated or AI-hallucinated citation. Standard academic use of
published research (citing findings, quoting abstracts for summary, linking to the
publisher's own DOI resolver) does not require a redistribution license the way bundled
image/media files do; FGPOWER links out to each paper's own `doi.org` URL rather than
hosting any full-text content.

---

## 5. Other datasets evaluated and rejected outright

For completeness, these were investigated and explicitly **not** used, with the reason:

- **`MuscleLib/musclelib-api`** — advertised as bilingual EN/PT with images; the live
  API returned 404 on every endpoint (not actually deployed), and its bundled images are
  the same unclear `free-exercise-db`/`wrkout` photos.
- **`exercemus/exercises`** — code is MIT, but only 1 of 872 exercise records actually
  carries license metadata despite the README claiming a wger+wrkout merge; unsafe to
  use without per-item provenance.
- **`hasaneyldrm/exercises-dataset`** (LogPress) — data fields are MIT, but its media is
  explicitly third-party (© Gym Visual, permission-only, not sublicensable to FGPOWER).
- **ExerciseDB (AscendAPI) / exercisedb.dev** — a paid, tiered commercial GIF product;
  its Kaggle mirror is mislabeled "MIT" but is the same commercial dataset.
- **MuscleWiki API** — proprietary; redistribution, offline storage, and AI/ML use are
  all explicitly forbidden in its terms.
- **Several Kaggle "gym exercises" datasets** — self-declared CC0 by uploaders who
  simultaneously admit to scraping Bodybuilding.com or unspecified "internet sources"; a
  license badge on Kaggle does not clear content the uploader never held rights to, so
  these were not used regardless of the label.
- **`everkinetic/data`** — genuinely CC BY-SA 4.0, but its image-hosting domains are
  dead (404 / non-resolving), making the images practically unusable regardless of
  license cleanliness.

---

## Summary for future maintainers

- **Safe to keep extending:** exercise text/metadata (`free-exercise-db`, Unlicense) and
  the scientific evidence base (real papers, DOI-verified).
- **Deliberately absent today:** exercise photography. This is a real product gap the
  license situation forced, not an oversight — see the recommended paths in §1 before
  re-adding any bundled image set.
