#!/usr/bin/env node
// Validates workflow-generated programs against the real catalog + science
// index (deterministically — no LLM), drops any invalid slug/evidence/
// principle, then merges into prisma/seed-data/programs.generated.json,
// deduping by slug. Usage: node scripts/merge-generated-programs.mjs <workflow-output.json>
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SCRATCH = "/tmp/claude-1000/-home-dev-peppa/8828c1da-c51f-48d9-9961-053fd91b144f/scratchpad";
const SEED = path.join(process.cwd(), "prisma", "seed-data", "programs.generated.json");

const VALID_PRINCIPLES = new Set([
  "rir", "training-to-failure", "progressive-overload", "double-progression", "training-volume",
  "training-frequency", "rep-ranges", "rest-intervals", "range-of-motion", "warm-up", "deloads",
  "concurrent-training", "estimated-1rm", "beginner-adaptation",
]);

async function main() {
  const workflowFile = process.argv[2];
  if (!workflowFile) throw new Error("pass the workflow output json path");

  const catalog = JSON.parse(await readFile(`${SCRATCH}/catalog-for-programs.json`, "utf8"));
  const validSlugs = new Set(catalog.map((e) => e.slug));
  const science = JSON.parse(await readFile(`${SCRATCH}/science-index-compact.json`, "utf8"));
  const validKeys = new Set(science.map((s) => s.key));

  // workflow output: could be {result:{programs:[...]}} (task file) or {programs:[...]}
  const raw = JSON.parse(await readFile(workflowFile, "utf8"));
  const incoming = raw.result?.programs ?? raw.programs ?? raw;
  if (!Array.isArray(incoming)) throw new Error("could not find programs array in workflow output");

  const existing = JSON.parse(await readFile(SEED, "utf8"));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  let added = 0;
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

    const cleaned = {
      ...p,
      evidenceKeys: (p.evidenceKeys || []).filter((k) => validKeys.has(k)),
      principleSlugs: (p.principleSlugs || []).filter((s) => VALID_PRINCIPLES.has(s)),
      days,
    };
    delete cleaned._droppedSlugs;

    bySlug.set(p.slug, cleaned); // upsert (replace if slug already present)
    added++;
    const exCount = days.reduce((n, d) => n + d.exercises.length, 0);
    report.push({ slug: p.slug, status: "OK", days: days.length, exercises: exCount, droppedSlugs });
  }

  const merged = Array.from(bySlug.values());
  await writeFile(SEED, JSON.stringify(merged, null, 1));

  console.log(`Merged. total programs in seed: ${merged.length} (added/updated ${added})`);
  for (const r of report) {
    console.log(`  ${r.slug.padEnd(26)} ${r.status}${r.days ? ` — ${r.days}d/${r.exercises}ex` : ""}${r.droppedSlugs?.length ? ` — dropped: ${r.droppedSlugs.join(",")}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
