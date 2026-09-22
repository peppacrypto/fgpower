#!/usr/bin/env node
// Validates workflow-generated programs against the real catalog + science
// index (deterministically — no LLM), drops any invalid slug/evidence/
// principle, then merges into prisma/seed-data/programs.generated.json,
// deduping by slug.
//
// Usage: node scripts/merge-generated-programs.mjs <workflow-output.json> [--prepend]
//   --prepend  place the incoming programs (in their given order) at the front
//              of the list, so they sort right after the flagship template.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SEED_DIR = path.join(process.cwd(), "prisma", "seed-data");
const SEED = path.join(SEED_DIR, "programs.generated.json");

async function loadValidPrinciples() {
  const src = await readFile(path.join(SEED_DIR, "principles.ts"), "utf8");
  return new Set([...src.matchAll(/^\s{4}slug: "([a-z0-9-]+)"/gm)].map((m) => m[1]));
}

async function main() {
  const args = process.argv.slice(2);
  const prepend = args.includes("--prepend");
  const workflowFile = args.find((a) => !a.startsWith("--"));
  if (!workflowFile) throw new Error("pass the workflow output json path");

  const catalog = JSON.parse(await readFile(path.join(SEED_DIR, "exercises.generated.json"), "utf8"));
  const validSlugs = new Set(catalog.map((e) => e.slug));
  const science = JSON.parse(await readFile(path.join(SEED_DIR, "science.generated.json"), "utf8"));
  const validKeys = new Set(science.sources.filter((s) => s.doi).map((s) => s.key));
  const validPrinciples = await loadValidPrinciples();

  // workflow output: could be {result:{programs:[...]}} (task file) or {programs:[...]}
  const raw = JSON.parse(await readFile(workflowFile, "utf8"));
  const incoming = raw.result?.programs ?? raw.programs ?? raw;
  if (!Array.isArray(incoming)) throw new Error("could not find programs array in workflow output");

  const existing = JSON.parse(await readFile(SEED, "utf8"));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  const cleanedIncoming = [];
  const report = [];
  for (const p of incoming) {
    if (!p || !p.slug) continue;
    const droppedSlugs = [];
    const days = (p.days || [])
      .map((d) => ({
        ...d,
        exercises: (d.exercises || []).filter((e) => {
          const ok = validSlugs.has(e.exerciseSlug);
          if (!ok) droppedSlugs.push(e.exerciseSlug);
          return ok;
        }),
      }))
      .filter((d) => d.exercises.length > 0)
      .map((d, i) => ({ ...d, dayIndex: i })); // renumber days contiguously

    if (days.length === 0) {
      report.push({ slug: p.slug, status: "SKIPPED (no valid days)", droppedSlugs });
      continue;
    }

    const droppedKeys = (p.evidenceKeys || []).filter((k) => !validKeys.has(k));
    const droppedPrinciples = (p.principleSlugs || []).filter((s) => !validPrinciples.has(s));
    const cleaned = {
      ...p,
      evidenceKeys: (p.evidenceKeys || []).filter((k) => validKeys.has(k)),
      principleSlugs: (p.principleSlugs || []).filter((s) => validPrinciples.has(s)),
      days,
    };
    delete cleaned._droppedSlugs;

    cleanedIncoming.push(cleaned);
    const exCount = days.reduce((n, d) => n + d.exercises.length, 0);
    report.push({ slug: p.slug, status: "OK", days: days.length, exercises: exCount, droppedSlugs, droppedKeys, droppedPrinciples });
  }

  let merged;
  if (prepend) {
    const incomingSlugs = new Set(cleanedIncoming.map((p) => p.slug));
    merged = [...cleanedIncoming, ...existing.filter((p) => !incomingSlugs.has(p.slug))];
  } else {
    for (const p of cleanedIncoming) bySlug.set(p.slug, p); // upsert (replace if slug already present)
    merged = Array.from(bySlug.values());
  }
  await writeFile(SEED, JSON.stringify(merged, null, 1));

  console.log(`Merged. total programs in seed: ${merged.length} (added/updated ${cleanedIncoming.length})`);
  for (const r of report) {
    const extras = [
      r.droppedSlugs?.length ? `dropped exercises: ${r.droppedSlugs.join(",")}` : "",
      r.droppedKeys?.length ? `dropped evidence: ${r.droppedKeys.join(",")}` : "",
      r.droppedPrinciples?.length ? `dropped principles: ${r.droppedPrinciples.join(",")}` : "",
    ].filter(Boolean);
    console.log(`  ${r.slug.padEnd(26)} ${r.status}${r.days ? ` — ${r.days}d/${r.exercises}ex` : ""}${extras.length ? ` — ${extras.join(" — ")}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
