#!/usr/bin/env node
// Adds workflow-researched evidence sources to prisma/seed-data/science.generated.json
// after re-verifying every one deterministically against Crossref (DOI must
// resolve; title, year and first author must match what Crossref returns).
// Sources that fail are reported and skipped — never merged "with reduced
// confidence" (see docs/SCIENCE_METHOD.md).
//
// Usage: node scripts/merge-evidence-sources.mjs <sources.json> [--dry-run]
//   <sources.json> is an array of {key,title,authors,journal,year,doi,pubmedId?,
//   evidenceType,evidenceLevel,summaryEn,summaryPt?,topics[]}.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SCIENCE = path.join(process.cwd(), "prisma", "seed-data", "science.generated.json");
const EVIDENCE_TYPES = new Set([
  "guideline", "systematic_review", "meta_analysis", "umbrella_review", "rct", "controlled_trial",
  "crossover_trial", "biomechanical", "emg", "observational", "expert_consensus", "narrative_review",
]);
const LEVELS = new Set(["A", "B", "C", "D"]);

const norm = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/<[^>]+>/g, " ")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function titleSimilarity(a, b) {
  const ta = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

async function crossref(doi) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { "User-Agent": "fgpower-evidence-check/1.0 (mailto:noreply@fgpower.monster)" },
    });
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()).message;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`crossref unavailable for ${doi}`);
}

function crossrefYears(m) {
  const years = new Set();
  for (const k of ["published-print", "published-online", "issued", "published"]) {
    const y = m[k]?.["date-parts"]?.[0]?.[0];
    if (y) years.add(y);
  }
  return years;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("pass the sources json path");

  const incoming = JSON.parse(await readFile(file, "utf8"));
  const science = JSON.parse(await readFile(SCIENCE, "utf8"));
  const byKey = new Map(science.sources.map((s) => [s.key, s]));
  const byDoi = new Map(science.sources.filter((s) => s.doi).map((s) => [s.doi.toLowerCase(), s]));

  const added = [];
  const report = [];
  for (const s of incoming) {
    const doi = String(s.doi ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
    const fail = (why) => report.push({ key: s.key, status: `REJECTED: ${why}` });
    if (!s.key || !/^[a-z0-9-]+$/.test(s.key)) { fail("bad key"); continue; }
    if (!/^10\.\d{4,9}\/\S+$/.test(doi)) { fail(`bad doi "${s.doi}"`); continue; }
    if (byDoi.has(doi)) { report.push({ key: s.key, status: `exists as ${byDoi.get(doi).key}` }); continue; }
    if (byKey.has(s.key)) { fail("key already used by a different DOI"); continue; }
    if (!EVIDENCE_TYPES.has(s.evidenceType)) { fail(`bad evidenceType ${s.evidenceType}`); continue; }
    if (!LEVELS.has(s.evidenceLevel)) { fail(`bad evidenceLevel ${s.evidenceLevel}`); continue; }
    if (!s.summaryEn || s.summaryEn.length < 80) { fail("summaryEn missing/too short"); continue; }

    const m = await crossref(doi);
    if (!m) { fail("DOI does not resolve on Crossref"); continue; }
    const crTitle = [m.title?.[0], m.subtitle?.[0]].filter(Boolean).join(": ");
    const sim = titleSimilarity(s.title, crTitle);
    if (sim < 0.7) { fail(`title mismatch (${sim.toFixed(2)}): crossref="${crTitle}"`); continue; }
    const years = crossrefYears(m);
    if (years.size && ![...years].some((y) => Math.abs(y - s.year) <= 1)) {
      fail(`year mismatch: given ${s.year}, crossref ${[...years].join("/")}`);
      continue;
    }
    const firstFamily = norm(m.author?.[0]?.family ?? "");
    if (firstFamily && !norm(s.authors).split(" ").includes(firstFamily.split(" ").pop())) {
      fail(`first author mismatch: crossref "${m.author[0].family}" vs "${s.authors}"`);
      continue;
    }

    const source = {
      key: s.key,
      title: crTitle || s.title,
      authors: s.authors,
      journal: m["container-title"]?.[0] || s.journal,
      year: s.year,
      doi,
      pubmedId: s.pubmedId || "",
      url: `https://doi.org/${doi}`,
      evidenceType: s.evidenceType,
      evidenceLevel: s.evidenceLevel,
      summaryEn: s.summaryEn,
      ...(s.summaryPt ? { summaryPt: s.summaryPt } : {}),
      topics: s.topics ?? [],
      summaryFaithful: true,
      cluster: "gd-series-2026",
    };
    added.push(source);
    byKey.set(source.key, source);
    byDoi.set(doi, source);
    report.push({ key: s.key, status: "OK" });
  }

  if (!dryRun && added.length) {
    science.sources.push(...added);
    science.counts = { ...science.counts, final: science.sources.length };
    await writeFile(SCIENCE, JSON.stringify(science, null, 1));
  }
  for (const r of report) console.log(`  ${r.key.padEnd(48)} ${r.status}`);
  console.log(`${dryRun ? "[dry-run] " : ""}added ${added.length}; total sources ${science.sources.length + (dryRun ? added.length : 0)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
