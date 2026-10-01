#!/usr/bin/env node
// Validates the exercise-content seed data before it reaches `prisma/seed.ts`.
//
// Checks prisma/seed-data/{curated-exercises,exercise-relations,exercise-aliases,
// science,exercises,programs}.generated.json:
//   - every file parses;
//   - every exercise slug exists in the catalog (exercises.generated.json) and
//     every evidence key exists in science.generated.json (and has a DOI, since
//     the seed skips sources without one);
//   - curated entries have every required field non-empty in both languages;
//   - relations have a valid kind, no self-relations and no duplicates;
//   - aliases are non-empty, not duplicated within an exercise and not equal
//     to the exercise's own pt-BR name or to another catalog exercise's;
//   - program supersets are 2–4 adjacent rows sharing a groupKey, and every
//     template exercise has a movement pattern (unless none can fit it).
//
// Errors exit non-zero; warnings are printed but do not fail the run.
// Usage: node scripts/validate-content.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "prisma", "seed-data");
const KINDS = new Set(["REGRESSION", "PROGRESSION", "ALTERNATIVE"]);
const TEXT_FIELDS = ["setup", "breathing", "rangeOfMotion", "whyThisExerciseExists"];
const LIST_FIELDS = ["coachingCues", "commonMistakes"];

// Same normalization as src/lib/utils/normalize-text.ts (lowercase, no accents).
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const isText = (v) => typeof v === "string" && v.trim().length > 0;

const errors = [];
const warnings = [];
const error = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

async function load(name) {
  try {
    return JSON.parse(await readFile(path.join(DIR, name), "utf8"));
  } catch (err) {
    error(`${name}: cannot read/parse (${err.message})`);
    return null;
  }
}

const [catalog, curated, relations, aliases, science, programs] = await Promise.all([
  load("exercises.generated.json"),
  load("curated-exercises.generated.json"),
  load("exercise-relations.generated.json"),
  load("exercise-aliases.generated.json"),
  load("science.generated.json"),
  load("programs.generated.json"),
]);

const bySlug = new Map((catalog ?? []).map((e) => [e.slug, e]));
const sources = new Map((science?.sources ?? []).map((s) => [s.key, s]));

// --- science.generated.json -------------------------------------------------
if (science) {
  if (!Array.isArray(science.sources)) error("science.generated.json: `sources` is not an array");
  if (sources.size !== (science.sources ?? []).length) error("science.generated.json: duplicate source keys");
  for (const s of science.sources ?? []) {
    for (const f of ["key", "title", "summaryEn"]) if (!isText(s[f])) error(`source ${s.key ?? "?"}: empty ${f}`);
    if ("summaryPt" in s && !isText(s.summaryPt)) error(`source ${s.key}: summaryPt present but empty`);
  }
  const missingPt = (science.sources ?? []).filter((s) => !isText(s.summaryPt)).map((s) => s.key);
  if (missingPt.length) warn(`science: ${missingPt.length} sources without summaryPt (${missingPt.slice(0, 5).join(", ")}${missingPt.length > 5 ? ", ..." : ""})`);
}

// --- curated-exercises.generated.json ---------------------------------------
if (curated) {
  const seen = new Set();
  for (const c of curated) {
    const at = `curated ${c.slug ?? "?"}`;
    if (!bySlug.has(c.slug)) error(`${at}: slug not in catalog`);
    if (seen.has(c.slug)) error(`${at}: duplicate entry`);
    seen.add(c.slug);
    for (const f of TEXT_FIELDS) {
      for (const lang of ["En", "Pt"]) if (!isText(c[f + lang])) error(`${at}: empty ${f}${lang}`);
    }
    for (const f of LIST_FIELDS) {
      for (const lang of ["En", "Pt"]) {
        const list = c[f + lang];
        if (!Array.isArray(list) || list.length === 0 || !list.every(isText)) error(`${at}: empty ${f}${lang}`);
      }
      if (Array.isArray(c[f + "En"]) && Array.isArray(c[f + "Pt"]) && c[f + "En"].length !== c[f + "Pt"].length) {
        warn(`${at}: ${f}En has ${c[f + "En"].length} items, ${f}Pt has ${c[f + "Pt"].length}`);
      }
    }
    const keys = c.evidenceKeys ?? [];
    if (!Array.isArray(keys)) error(`${at}: evidenceKeys is not an array`);
    if (new Set(keys).size !== keys.length) error(`${at}: duplicate evidence keys`);
    for (const key of keys) {
      const s = sources.get(key);
      if (!s) error(`${at}: evidence key "${key}" not in science.generated.json`);
      else if (!s.doi) error(`${at}: evidence key "${key}" has no DOI (the seed skips it)`);
      if (!isText(c.evidenceNotesPt?.[key])) error(`${at}: no evidenceNotesPt for "${key}"`);
    }
    for (const key of Object.keys(c.evidenceNotesPt ?? {})) {
      if (!keys.includes(key)) warn(`${at}: evidenceNotesPt has "${key}" which is not in evidenceKeys`);
    }
  }
}

// --- exercise-relations.generated.json --------------------------------------
if (relations) {
  const seen = new Set();
  const orders = new Map();
  for (const r of relations) {
    const at = `relation ${r.slug} -> ${r.relatedSlug} (${r.kind})`;
    if (!bySlug.has(r.slug)) error(`${at}: slug "${r.slug}" not in catalog`);
    if (!bySlug.has(r.relatedSlug)) error(`${at}: related slug "${r.relatedSlug}" not in catalog`);
    if (!KINDS.has(r.kind)) error(`${at}: invalid kind`);
    if (r.slug === r.relatedSlug) error(`${at}: self-relation`);
    const key = `${r.slug}|${r.relatedSlug}|${r.kind}`;
    if (seen.has(key)) error(`${at}: duplicate`);
    seen.add(key);
    if (!Number.isInteger(r.sortOrder) || r.sortOrder < 0) error(`${at}: sortOrder must be a non-negative integer`);
    const o = orders.get(r.slug) ?? new Set();
    if (o.has(r.sortOrder)) warn(`${at}: sortOrder ${r.sortOrder} repeated for ${r.slug}`);
    o.add(r.sortOrder);
    orders.set(r.slug, o);
  }
}

// --- exercise-aliases.generated.json ----------------------------------------
if (aliases) {
  const namePtOwners = new Map();
  for (const e of catalog ?? []) {
    const n = norm(e.namePt);
    namePtOwners.set(n, [...(namePtOwners.get(n) ?? []), e.slug]);
  }
  const aliasOwners = new Map();
  const seenSlugs = new Set();
  for (const a of aliases) {
    const at = `aliases ${a.slug}`;
    const ex = bySlug.get(a.slug);
    if (!ex) error(`${at}: slug not in catalog`);
    if (seenSlugs.has(a.slug)) error(`${at}: duplicate entry`);
    seenSlugs.add(a.slug);
    if (!Array.isArray(a.aliases) || a.aliases.length === 0) {
      error(`${at}: no aliases`);
      continue;
    }
    const namePt = ex ? norm(ex.namePt) : null;
    const nameEn = ex ? norm(ex.nameEn) : null;
    const seen = new Set();
    for (const alias of a.aliases) {
      if (!isText(alias)) {
        error(`${at}: empty alias`);
        continue;
      }
      const n = norm(alias);
      if (seen.has(n)) error(`${at}: duplicate alias "${alias}"`);
      seen.add(n);
      if (n === namePt) error(`${at}: alias "${alias}" repeats the exercise's pt-BR name`);
      // The English name is already searchable; allowed because it is often the gym name in Brazil too.
      else if (n === nameEn) warn(`${at}: alias "${alias}" equals the English name (redundant for search)`);
      const others = (namePtOwners.get(n) ?? []).filter((s) => s !== a.slug);
      if (others.length) error(`${at}: alias "${alias}" is the name of another exercise (${others.join(", ")})`);
      aliasOwners.set(n, [...(aliasOwners.get(n) ?? []), a.slug]);
    }
  }
  for (const [alias, owners] of aliasOwners) {
    if (owners.length > 1) warn(`alias "${alias}" shared by ${owners.join(", ")}`);
  }
}

// --- programs.generated.json -------------------------------------------------
// Exercise slugs; supersets (W-104: a groupKey on 2–4 adjacent rows, never on
// one row alone); a movement pattern on every template exercise the checks
// can read one from (L-content-movement-patterns).
const MAX_GROUP_SIZE = 4; // src/lib/programming/groups.ts
const PATTERNLESS_CATEGORIES = new Set(["CARDIO", "PLYOMETRICS", "STRETCHING"]);
// No MovementPattern fits these (shrugs, neck, grip and forearm, rotator cuff,
// hip ab/adduction, a mobility drill): the checks that read patterns skip them.
const PATTERNLESS = new Set([
  "barbell-shrug",
  "cable-shrugs",
  "dumbbell-shrug",
  "isometric-neck-exercise-front-and-back",
  "plate-pinch",
  "wrist-roller",
  "external-rotation-with-cable",
  "thigh-abductor",
  "thigh-adductor",
  "kettlebell-halo",
]);
const groupKeyOf = (ex) => (typeof ex.groupKey === "string" && ex.groupKey.trim() ? ex.groupKey.trim().toUpperCase() : null);
if (programs) {
  for (const p of programs) {
    for (const d of p.days ?? []) {
      const list = d.exercises ?? [];
      const at = `program ${p.slug} day ${d.dayIndex}`;
      list.forEach((ex, i) => {
        const catalogEx = bySlug.get(ex.exerciseSlug);
        if (!catalogEx) error(`${at}: exercise "${ex.exerciseSlug}" not in catalog`);
        else if (!catalogEx.movementPattern && !PATTERNLESS_CATEGORIES.has(catalogEx.category) && !PATTERNLESS.has(ex.exerciseSlug)) {
          error(`${at}: exercise "${ex.exerciseSlug}" has no movementPattern (exercises.generated.json)`);
        }
        const key = groupKeyOf(ex);
        if (key && groupKeyOf(list[i - 1] ?? {}) !== key && groupKeyOf(list[i + 1] ?? {}) !== key) {
          error(`${at}: "${ex.exerciseSlug}" has groupKey "${ex.groupKey}" but no adjacent row shares it`);
        }
        if (!key && /(^|\. )Superset com /.test(ex.notesPt ?? "")) warn(`${at}: "${ex.exerciseSlug}" says "Superset com" but has no groupKey`);
      });
      // Runs of one key longer than a group can be.
      let run = 0;
      list.forEach((ex, i) => {
        const key = groupKeyOf(ex);
        run = key && groupKeyOf(list[i - 1] ?? {}) === key ? run + 1 : key ? 1 : 0;
        if (run === MAX_GROUP_SIZE + 1) error(`${at}: group "${key}" has more than ${MAX_GROUP_SIZE} exercises`);
      });
    }
  }
}

// --- report -----------------------------------------------------------------
const summary = {
  catalog: bySlug.size,
  curated: curated?.length ?? 0,
  relations: relations?.length ?? 0,
  relationExercises: new Set((relations ?? []).map((r) => r.slug)).size,
  aliasExercises: aliases?.length ?? 0,
  aliases: (aliases ?? []).reduce((n, a) => n + (a.aliases?.length ?? 0), 0),
  sources: sources.size,
  sourcesWithSummaryPt: (science?.sources ?? []).filter((s) => isText(s.summaryPt)).length,
};
console.log(JSON.stringify(summary));
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s).`);
process.exitCode = errors.length ? 1 : 0;
