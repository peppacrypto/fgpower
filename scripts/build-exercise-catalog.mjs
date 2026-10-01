#!/usr/bin/env node
// Deterministic mapping pass: merges free-exercise-db source data + our
// pt-BR translations (from the translation workflow) + our fixed taxonomy
// into prisma/seed-data/exercises.generated.json, which prisma/seed.ts
// upserts into the database. No network/LLM calls here — everything is a
// pure function of the inputs.
//
// Usage (from the repo root):
//   node scripts/build-exercise-catalog.mjs --source <free-exercise-db checkout>
//        [--translations <dir of pt-BR batch .json files>] [--overwrite]
//
// The file has been corrected by hand since the first build — equipment tags,
// movement patterns (L-content-movement-patterns), a few instructions — so a
// rerun keeps those fields (HAND_FIXED_FIELDS) for every slug already in it,
// keeps the slugs the source no longer has, and otherwise adds new slugs and
// refreshes the mapped fields. --overwrite rebuilds the file from the source
// alone, dropping those fixes. Without --source it does nothing (exit 1).
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const USAGE =
  "Usage: node scripts/build-exercise-catalog.mjs --source <free-exercise-db dir> [--translations <dir>] [--overwrite]";

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      source: { type: "string" },
      translations: { type: "string" },
      overwrite: { type: "boolean", default: false },
    },
  }));
} catch (err) {
  console.error(`${err.message}\n${USAGE}`);
  process.exit(1);
}
if (!args.source) {
  console.error(`Missing --source (the free-exercise-db checkout).\n${USAGE}`);
  process.exit(1);
}

const SOURCE_DIR = path.resolve(args.source);
const PT_BATCH_DIR = args.translations ? path.resolve(args.translations) : null;
const SEED_DATA_DIR = path.join(process.cwd(), "prisma", "seed-data");
const CATALOG_FILE = path.join(SEED_DATA_DIR, "exercises.generated.json");

/** Fields fixed by hand in the generated file: a rerun keeps them for existing slugs unless --overwrite. */
const HAND_FIXED_FIELDS = ["equipment", "movementPattern", "namePt", "instructionsEn", "instructionsPt"];

// --- muscle mapping (fedb tag -> our Muscle slug) -------------------------
const MUSCLE_MAP = {
  chest: "chest",
  lats: "lats",
  traps: "traps",
  "middle back": "middle-back",
  "lower back": "spinal-erectors",
  shoulders: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  quadriceps: "quadriceps",
  hamstrings: "hamstrings",
  calves: "calves",
  adductors: "adductors",
  abductors: "abductors",
  glutes: "glutes",
  abdominals: "abdominals",
  neck: "neck",
};

// --- equipment mapping (fedb equipment -> our Equipment slug) -------------
const EQUIPMENT_MAP = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  "e-z curl bar": "ez-bar",
  kettlebells: "kettlebell",
  machine: "machine",
  cable: "cable",
  "body only": "bodyweight",
  bands: "resistance-band",
  "medicine ball": "medicine-ball",
  "exercise ball": "exercise-ball",
  "foam roll": "foam-roller",
  other: "other-equipment",
};
function mapEquipment(fedbEquipment) {
  if (!fedbEquipment) return "none";
  return EQUIPMENT_MAP[fedbEquipment] ?? "other-equipment";
}

// --- category mapping -------------------------------------------------
const CATEGORY_MAP = {
  strength: "STRENGTH",
  stretching: "STRETCHING",
  plyometrics: "PLYOMETRICS",
  powerlifting: "POWERLIFTING",
  "olympic weightlifting": "OLYMPIC_WEIGHTLIFTING",
  strongman: "STRONGMAN",
  cardio: "CARDIO",
};

const DIFFICULTY_MAP = { beginner: "BEGINNER", intermediate: "INTERMEDIATE", expert: "ADVANCED" };
const FORCE_MAP = { push: "PUSH", pull: "PULL", static: "STATIC" };

function mapMechanics(fedb) {
  if (fedb.mechanic === "compound") return "COMPOUND";
  if (fedb.mechanic === "isolation") return "ISOLATION";
  // heuristic fallback when fedb leaves it null
  const multiJoint = /(squat|deadlift|press|row|pull-?up|chin-?up|lunge|thrust|clean|snatch|jerk|dip|push-?up)/i.test(
    fedb.name,
  );
  return multiJoint || fedb.primaryMuscles.length > 1 ? "COMPOUND" : "ISOLATION";
}

function mapLaterality(name) {
  if (/altern/i.test(name)) return "ALTERNATING";
  if (/(single[- ]arm|single[- ]leg|one[- ]arm|one[- ]leg|unilateral)/i.test(name)) return "UNILATERAL";
  return "BILATERAL";
}

// --- movement pattern inference (best-effort keyword heuristics) ----------
function mapMovementPattern(fedb) {
  const n = fedb.name.toLowerCase();
  const prim = fedb.primaryMuscles;
  const has = (arr, m) => arr.includes(m);

  if (/(squat|hack squat|leg press)/.test(n)) return "squat";
  if (/(deadlift|good morning|hyperextension|rdl|romanian)/.test(n)) return "hinge";
  if (/(hip thrust|glute bridge)/.test(n)) return "hip-extension";
  if (/(lunge|split squat|step[- ]up)/.test(n)) return "lunge";
  if (/(carry|farmer)/.test(n)) return "carry";
  if (/(clean|snatch|jerk)/.test(n)) return "olympic";
  if (/(calf raise)/.test(n)) return "plantar-flexion";
  if (/(leg curl|lying leg curl|seated leg curl|nordic)/.test(n)) return "knee-flexion";
  if (/(leg extension)/.test(n)) return "knee-extension";
  if (/(crunch|sit-?up|v-up)/.test(n)) return "trunk-flexion";
  if (/(plank|dead bug|hollow)/.test(n)) return "anti-extension";
  if (/(wood chop|pallof|russian twist)/.test(n)) return "rotation";
  if (/(lat pulldown|pull-?up|chin-?up)/.test(n)) return "vertical-pull";
  if (/(row)/.test(n)) return "horizontal-pull";
  if (/(overhead press|shoulder press|military press|push press)/.test(n)) return "vertical-push";
  if (/(bench press|chest press|push-?up|fly|flye|dip)/.test(n) && has(prim, "chest")) return "horizontal-push";
  if (/(lateral raise|front raise)/.test(n)) return "shoulder-abduction";
  if (/(rear delt|reverse fly|face pull)/.test(n)) return "shoulder-extension";
  if (/(curl)/.test(n) && (has(prim, "biceps") || has(prim, "forearms"))) return "elbow-flexion";
  if (/(extension|pushdown|kickback)/.test(n) && has(prim, "triceps")) return "elbow-extension";
  if (/(hip adduction)/.test(n)) return null;
  if (/(hip abduction)/.test(n)) return null;
  return null;
}

async function loadTranslations() {
  const map = new Map();
  let files = [];
  if (!PT_BATCH_DIR) {
    console.warn("No --translations: new exercises get their English names (existing ones keep theirs).");
    return map;
  }
  try {
    files = (await readdir(PT_BATCH_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    console.warn(`No translation batches found at ${PT_BATCH_DIR} — new exercises get their English names.`);
  }
  for (const f of files) {
    const data = JSON.parse(await readFile(path.join(PT_BATCH_DIR, f), "utf8"));
    for (const item of data.items ?? []) {
      map.set(item.id, item);
    }
  }
  return map;
}

function slugify(fedbId) {
  return fedbId
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The catalog as it is now, by slug (empty when there's none yet). */
async function loadExisting() {
  try {
    const list = JSON.parse(await readFile(CATALOG_FILE, "utf8"));
    return new Map(list.map((e) => [e.slug, e]));
  } catch (err) {
    if (err.code === "ENOENT") return new Map();
    throw err;
  }
}

async function main() {
  const source = JSON.parse(await readFile(path.join(SOURCE_DIR, "dist", "exercises.json"), "utf8"));
  const mediaManifest = JSON.parse(
    await readFile(path.join(SEED_DATA_DIR, "exercise-media.generated.json"), "utf8"),
  );
  const mediaBySource = new Map(mediaManifest.map((m) => [m.sourceId, m]));
  const translations = await loadTranslations();
  const existing = args.overwrite ? new Map() : await loadExisting();

  const exercises = [];
  let missingTranslation = 0;
  let kept = 0;
  const differs = new Map(HAND_FIXED_FIELDS.map((f) => [f, 0]));

  for (const fedb of source) {
    const slug = slugify(fedb.id);
    const previous = existing.get(slug);
    const t = translations.get(fedb.id);
    if (!t && !previous) missingTranslation++;
    const media = mediaBySource.get(fedb.id);

    const built = {
      sourceId: fedb.id,
      slug,
      nameEn: fedb.name,
      namePt: t?.namePt ?? fedb.name,
      category: CATEGORY_MAP[fedb.category] ?? "STRENGTH",
      movementPattern: mapMovementPattern(fedb),
      equipment: mapEquipment(fedb.equipment),
      difficulty: DIFFICULTY_MAP[fedb.level] ?? "BEGINNER",
      forceType: FORCE_MAP[fedb.force] ?? "OTHER",
      laterality: mapLaterality(fedb.name),
      mechanics: mapMechanics(fedb),
      instructionsEn: fedb.instructions,
      instructionsPt: t?.instructionsPt ?? fedb.instructions,
      primaryMuscles: fedb.primaryMuscles.map((m) => MUSCLE_MAP[m]).filter(Boolean),
      secondaryMuscles: fedb.secondaryMuscles.map((m) => MUSCLE_MAP[m]).filter(Boolean),
      media: (media?.media ?? []).map((m) => ({
        kind: m.index === 0 ? "IMAGE_START" : "IMAGE_END",
        url: m.path,
        width: m.width,
        height: m.height,
        sortOrder: m.index,
      })),
    };
    if (previous) {
      kept++;
      existing.delete(slug);
      for (const field of HAND_FIXED_FIELDS) {
        if (!(field in previous)) continue;
        if (JSON.stringify(previous[field]) !== JSON.stringify(built[field])) differs.set(field, differs.get(field) + 1);
        built[field] = previous[field];
      }
    }
    exercises.push(built);
  }
  // No longer in the source (or never from it): kept as they are — programs may use them.
  const orphans = [...existing.values()];
  exercises.push(...orphans);

  await writeFile(CATALOG_FILE, JSON.stringify(exercises, null, 1));

  console.log(`Built catalog: ${exercises.length} exercises. New ones without a pt-BR translation: ${missingTranslation}`);
  if (orphans.length > 0) console.log(`Kept ${orphans.length} exercises the source no longer has. --overwrite drops them.`);
  if (kept > 0) {
    const changed = [...differs].filter(([, n]) => n > 0).map(([f, n]) => `${f} ${n}`);
    console.log(
      `Kept the hand-fixed fields of ${kept} existing exercises${changed.length ? ` (a fresh mapping differs: ${changed.join(", ")})` : ""}. --overwrite replaces them.`,
    );
  }
  const noPattern = exercises.filter((e) => !e.movementPattern).length;
  console.log(`Exercises without an inferred movement pattern: ${noPattern} (left null; fine, it's optional)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
