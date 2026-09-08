#!/usr/bin/env node
// One-time data-prep step: resize/re-encode the free-exercise-db images to a
// web-friendly WebP size and write them into public/exercises/<slug>/, plus a
// manifest at prisma/seed-data/exercise-media.generated.json. Not run at
// build/deploy time; its output (public/exercises/*) is committed to the repo.
//
// ⚠️ Licensing note: the project owner opted to include these photos with full
// knowledge that their upstream provenance (wrkout/exercises.json) disclaims
// commercial redistribution rights — see docs/DATA_SOURCES.md for the full
// writeup and the cleaner alternatives (e.g. wger.de's CC-BY-SA images).
import sharp from "sharp";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SOURCE_DIR =
  process.env.FEDB_DIR ||
  "/tmp/claude-1000/-home-dev-peppa/8828c1da-c51f-48d9-9961-053fd91b144f/scratchpad/research/free-exercise-db";
const OUT_DIR = path.join(process.cwd(), "public", "exercises");
const TARGET_WIDTH = 640;
const WEBP_QUALITY = 78;

function slugify(fedbId) {
  return fedbId
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const exercises = JSON.parse(
    await readFile(path.join(SOURCE_DIR, "dist", "exercises.json"), "utf8"),
  );
  await mkdir(OUT_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  const manifest = [];

  // Process with bounded concurrency (sharp releases the event loop while
  // doing native work, so this is safe well above 1).
  const CONCURRENCY = 12;
  let cursor = 0;

  async function worker() {
    while (cursor < exercises.length) {
      const ex = exercises[cursor++];
      if (!ex.images || ex.images.length === 0) {
        skipped++;
        continue;
      }
      const slug = slugify(ex.id);
      const destDir = path.join(OUT_DIR, slug);
      await mkdir(destDir, { recursive: true });

      const media = [];
      for (let i = 0; i < ex.images.length; i++) {
        const srcPath = path.join(SOURCE_DIR, "exercises", ex.images[i]);
        const destPath = path.join(destDir, `${i}.webp`);
        if (!existsSync(srcPath)) continue;
        const img = sharp(srcPath).rotate();
        const meta = await img.metadata();
        const width = Math.min(TARGET_WIDTH, meta.width ?? TARGET_WIDTH);
        const resized = img.resize({ width, withoutEnlargement: true });
        const info = await resized.webp({ quality: WEBP_QUALITY }).toFile(destPath);
        media.push({ index: i, width: info.width, height: info.height, path: `/exercises/${slug}/${i}.webp` });
      }
      manifest.push({ sourceId: ex.id, slug, media });
      processed++;
      if (processed % 100 === 0) console.log(`processed ${processed}/${exercises.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      path.join(process.cwd(), "prisma", "seed-data", "exercise-media.generated.json"),
      JSON.stringify(manifest, null, 1),
    ),
  );

  console.log(`Done. processed=${processed} skipped(no image)=${skipped}`);

  // Sanity: total output size
  let totalBytes = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else totalBytes += (await import("node:fs")).statSync(p).size;
    }
  }
  await walk(OUT_DIR);
  console.log(`Total output size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
