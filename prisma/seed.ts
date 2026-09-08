// Idempotent database seed. Run with: npx prisma db seed (or `prisma migrate
// dev`, which runs it automatically). Safe to re-run — every write is an
// upsert keyed on a stable slug/id.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { MUSCLES, EQUIPMENT, MOVEMENT_PATTERNS } from "./seed-data/taxonomy";
import { PRINCIPLES } from "./seed-data/principles";
import { FLAGSHIP_PROGRAM } from "./seed-data/flagship-program";

interface CuratedExercise {
  slug: string;
  setupEn: string; setupPt: string;
  breathingEn: string; breathingPt: string;
  coachingCuesEn: string[]; coachingCuesPt: string[];
  commonMistakesEn: string[]; commonMistakesPt: string[];
  rangeOfMotionEn: string; rangeOfMotionPt: string;
  whyThisExerciseExistsEn: string; whyThisExerciseExistsPt: string;
  evidenceKeys: string[];
  evidenceNotesPt: Record<string, string>;
}
import { normalizeText } from "../src/lib/utils/normalize-text";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEED_DATA_DIR = path.join(__dirname, "seed-data");

interface GeneratedExercise {
  sourceId: string;
  slug: string;
  nameEn: string;
  namePt: string;
  category: string;
  movementPattern: string | null;
  equipment: string;
  difficulty: string;
  forceType: string;
  laterality: string;
  mechanics: string;
  instructionsEn: string[];
  instructionsPt: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  media: { kind: string; url: string; width: number; height: number; sortOrder: number }[];
}

async function seedTaxonomy() {
  for (const m of MUSCLES) {
    await prisma.muscle.upsert({
      where: { id: m.id },
      create: { id: m.id, nameEn: m.nameEn, namePt: m.namePt, group: m.group, sortOrder: m.sortOrder },
      update: { nameEn: m.nameEn, namePt: m.namePt, group: m.group, sortOrder: m.sortOrder },
    });
  }
  for (const e of EQUIPMENT) {
    await prisma.equipment.upsert({
      where: { id: e.id },
      create: { id: e.id, nameEn: e.nameEn, namePt: e.namePt, category: e.category, sortOrder: e.sortOrder },
      update: { nameEn: e.nameEn, namePt: e.namePt, category: e.category, sortOrder: e.sortOrder },
    });
  }
  for (const p of MOVEMENT_PATTERNS) {
    await prisma.movementPattern.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        nameEn: p.nameEn,
        namePt: p.namePt,
        descriptionEn: p.descriptionEn,
        descriptionPt: p.descriptionPt,
        sortOrder: p.sortOrder,
      },
      update: {
        nameEn: p.nameEn,
        namePt: p.namePt,
        descriptionEn: p.descriptionEn,
        descriptionPt: p.descriptionPt,
        sortOrder: p.sortOrder,
      },
    });
  }
  console.log(`Taxonomy: ${MUSCLES.length} muscles, ${EQUIPMENT.length} equipment, ${MOVEMENT_PATTERNS.length} movement patterns.`);
}

function normalizeSearchText(ex: GeneratedExercise, aliases: string[]) {
  return normalizeText([ex.nameEn, ex.namePt, ...aliases].join(" "));
}

interface GeneratedEvidenceSource {
  key: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  doi: string;
  pubmedId?: string;
  url: string;
  evidenceType: string;
  evidenceLevel: string;
  summaryEn: string;
  topics: string[];
}

async function seedEvidence() {
  const file = path.join(SEED_DATA_DIR, "science.generated.json");
  let sources: GeneratedEvidenceSource[];
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    sources = parsed.sources;
  } catch {
    console.warn(`No generated science data at ${file} — skipping evidence seed.`);
    return;
  }

  let count = 0;
  for (const s of sources) {
    if (!s.doi) continue;
    await prisma.evidenceSource.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        title: s.title,
        authors: s.authors,
        journal: s.journal,
        publicationYear: s.year,
        doi: s.doi.toLowerCase(),
        pubmedId: s.pubmedId || null,
        url: s.url,
        evidenceType: s.evidenceType.toUpperCase() as never,
        evidenceLevel: s.evidenceLevel as never,
        abstractSummary: s.summaryEn,
        topics: s.topics,
      },
      update: {
        title: s.title,
        authors: s.authors,
        journal: s.journal,
        publicationYear: s.year,
        pubmedId: s.pubmedId || null,
        url: s.url,
        evidenceType: s.evidenceType.toUpperCase() as never,
        evidenceLevel: s.evidenceLevel as never,
        abstractSummary: s.summaryEn,
        topics: s.topics,
      },
    });
    count++;
  }
  console.log(`Evidence sources: upserted ${count}.`);
}

async function seedPrinciples() {
  let count = 0;
  for (const p of PRINCIPLES) {
    const principle = await prisma.trainingPrinciple.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        titleEn: p.titleEn,
        titlePt: p.titlePt,
        summaryEn: p.summaryEn,
        summaryPt: p.summaryPt,
        bodyEn: p.bodyEn,
        bodyPt: p.bodyPt,
        sortOrder: p.sortOrder,
      },
      update: {
        titleEn: p.titleEn,
        titlePt: p.titlePt,
        summaryEn: p.summaryEn,
        summaryPt: p.summaryPt,
        bodyEn: p.bodyEn,
        bodyPt: p.bodyPt,
        sortOrder: p.sortOrder,
      },
    });

    await prisma.trainingPrincipleEvidence.deleteMany({ where: { principleId: principle.id } });
    let sortOrder = 0;
    for (const key of p.evidenceKeys) {
      const source = await prisma.evidenceSource.findUnique({ where: { key } });
      if (!source) {
        console.warn(`  principle "${p.slug}": evidence source "${key}" not found, skipping link.`);
        continue;
      }
      await prisma.trainingPrincipleEvidence.create({
        data: { principleId: principle.id, sourceId: source.id, sortOrder: sortOrder++ },
      });
    }
    count++;
  }
  console.log(`Training principles: upserted ${count}.`);
}

async function seedFlagshipProgram() {
  const p = FLAGSHIP_PROGRAM;

  const template = await prisma.workoutTemplate.upsert({
    where: { slug: p.slug },
    create: {
      slug: p.slug,
      version: p.version,
      nameEn: p.nameEn,
      namePt: p.namePt,
      taglineEn: p.taglineEn,
      taglinePt: p.taglinePt,
      descriptionEn: p.descriptionEn,
      descriptionPt: p.descriptionPt,
      audienceEn: p.audienceEn,
      audiencePt: p.audiencePt,
      goal: p.goal as never,
      experienceLevel: p.experienceLevel as never,
      daysPerWeek: p.daysPerWeek,
      durationWeeks: p.durationWeeks,
      sessionMinutes: p.sessionMinutes,
      equipmentAccess: p.equipmentAccess as never,
      trainingStyle: p.trainingStyle as never,
      progressionStrategy: p.progressionStrategy as never,
      isFlagship: p.isFlagship,
      rationaleEn: p.rationaleEn,
      rationalePt: p.rationalePt,
      restGuidanceEn: p.restGuidanceEn,
      restGuidancePt: p.restGuidancePt,
      weeklyGuidance: p.weeklyGuidance as never,
      sortOrder: 0,
    },
    update: {
      nameEn: p.nameEn,
      namePt: p.namePt,
      taglineEn: p.taglineEn,
      taglinePt: p.taglinePt,
      descriptionEn: p.descriptionEn,
      descriptionPt: p.descriptionPt,
      audienceEn: p.audienceEn,
      audiencePt: p.audiencePt,
      rationaleEn: p.rationaleEn,
      rationalePt: p.rationalePt,
      restGuidanceEn: p.restGuidanceEn,
      restGuidancePt: p.restGuidancePt,
      weeklyGuidance: p.weeklyGuidance as never,
    },
  });

  for (const day of p.days) {
    const dayRow = await prisma.workoutTemplateDay.upsert({
      where: { templateId_dayIndex: { templateId: template.id, dayIndex: day.dayIndex } },
      create: {
        templateId: template.id,
        dayIndex: day.dayIndex,
        nameEn: day.nameEn,
        namePt: day.namePt,
        focusEn: day.focusEn,
        focusPt: day.focusPt,
        estimatedMinutes: day.estimatedMinutes,
      },
      update: {
        nameEn: day.nameEn,
        namePt: day.namePt,
        focusEn: day.focusEn,
        focusPt: day.focusPt,
        estimatedMinutes: day.estimatedMinutes,
      },
    });

    await prisma.workoutTemplateExercise.deleteMany({ where: { dayId: dayRow.id } });
    let sortOrder = 0;
    for (const ex of day.exercises) {
      const exercise = await prisma.exercise.findUnique({ where: { slug: ex.exerciseSlug } });
      if (!exercise) {
        console.warn(`  flagship program: exercise slug "${ex.exerciseSlug}" not found, skipping.`);
        continue;
      }
      await prisma.workoutTemplateExercise.create({
        data: {
          dayId: dayRow.id,
          exerciseId: exercise.id,
          sortOrder: sortOrder++,
          alternativeSlugs: ex.alternativeSlugs ?? [],
          sets: ex.sets,
          repMin: ex.repMin,
          repMax: ex.repMax,
          rirTarget: ex.rirTarget,
          restSeconds: ex.restSeconds,
          warmupSets: ex.warmupSets ?? 0,
          notesEn: ex.notesEn,
          notesPt: ex.notesPt,
        },
      });
    }
  }

  await prisma.workoutTemplateEvidence.deleteMany({ where: { templateId: template.id } });
  let evOrder = 0;
  for (const key of p.evidenceKeys) {
    const source = await prisma.evidenceSource.findUnique({ where: { key } });
    if (!source) continue;
    await prisma.workoutTemplateEvidence.create({
      data: { templateId: template.id, sourceId: source.id, sortOrder: evOrder++ },
    });
  }

  await prisma.workoutTemplatePrinciple.deleteMany({ where: { templateId: template.id } });
  let prOrder = 0;
  for (const slug of p.principleSlugs) {
    const principle = await prisma.trainingPrinciple.findUnique({ where: { slug } });
    if (!principle) continue;
    await prisma.workoutTemplatePrinciple.create({
      data: { templateId: template.id, principleId: principle.id, sortOrder: prOrder++ },
    });
  }

  console.log(`Flagship program "${p.namePt}": seeded with ${p.days.length} days.`);
}

async function seedCuratedExerciseContent() {
  const file = path.join(SEED_DATA_DIR, "curated-exercises.generated.json");
  let curated: CuratedExercise[];
  try {
    curated = JSON.parse(await readFile(file, "utf8"));
  } catch {
    console.warn(`No curated exercise content at ${file} — skipping.`);
    return;
  }

  let count = 0;
  for (const c of curated) {
    const exercise = await prisma.exercise.findUnique({ where: { slug: c.slug } });
    if (!exercise) {
      console.warn(`  curated content: exercise slug "${c.slug}" not found, skipping.`);
      continue;
    }

    const contentEn = {
      setup: c.setupEn,
      breathing: c.breathingEn,
      coachingCues: c.coachingCuesEn,
      commonMistakes: c.commonMistakesEn,
      rangeOfMotion: c.rangeOfMotionEn,
      whyThisExerciseExists: c.whyThisExerciseExistsEn,
    };
    const contentPt = {
      setup: c.setupPt,
      breathing: c.breathingPt,
      coachingCues: c.coachingCuesPt,
      commonMistakes: c.commonMistakesPt,
      rangeOfMotion: c.rangeOfMotionPt,
      whyThisExerciseExists: c.whyThisExerciseExistsPt,
    };

    await prisma.exercise.update({
      where: { id: exercise.id },
      data: { isCurated: true, contentEn: contentEn as never, contentPt: contentPt as never },
    });

    let sortOrder = 0;
    for (const key of c.evidenceKeys) {
      const source = await prisma.evidenceSource.findUnique({ where: { key } });
      if (!source) {
        console.warn(`  curated content: evidence key "${key}" not found for ${c.slug}, skipping link.`);
        continue;
      }
      await prisma.exerciseEvidence.upsert({
        where: { exerciseId_sourceId: { exerciseId: exercise.id, sourceId: source.id } },
        create: { exerciseId: exercise.id, sourceId: source.id, notePt: c.evidenceNotesPt[key] ?? null, sortOrder: sortOrder++ },
        update: { notePt: c.evidenceNotesPt[key] ?? null, sortOrder: sortOrder++ },
      });
    }
    count++;
  }
  console.log(`Curated exercise content: applied to ${count} exercises.`);
}

async function seedExercises() {
  const file = path.join(SEED_DATA_DIR, "exercises.generated.json");
  let exercises: GeneratedExercise[];
  try {
    exercises = JSON.parse(await readFile(file, "utf8"));
  } catch {
    console.warn(
      `No generated exercise catalog at ${file} — skipping exercise seed. Run scripts/process-exercise-images.mjs then scripts/build-exercise-catalog.mjs first.`,
    );
    return;
  }

  let count = 0;
  for (const ex of exercises) {
    const searchText = normalizeSearchText(ex, []);

    const exercise = await prisma.exercise.upsert({
      where: { slug: ex.slug },
      create: {
        slug: ex.slug,
        sourceId: ex.sourceId,
        nameEn: ex.nameEn,
        namePt: ex.namePt,
        category: ex.category as never,
        movementPatternId: ex.movementPattern,
        equipmentId: ex.equipment,
        difficulty: ex.difficulty as never,
        forceType: ex.forceType as never,
        laterality: ex.laterality as never,
        mechanics: ex.mechanics as never,
        instructionsEn: ex.instructionsEn,
        instructionsPt: ex.instructionsPt,
        searchText,
      },
      update: {
        nameEn: ex.nameEn,
        namePt: ex.namePt,
        category: ex.category as never,
        movementPatternId: ex.movementPattern,
        equipmentId: ex.equipment,
        difficulty: ex.difficulty as never,
        forceType: ex.forceType as never,
        laterality: ex.laterality as never,
        mechanics: ex.mechanics as never,
        instructionsEn: ex.instructionsEn,
        instructionsPt: ex.instructionsPt,
        searchText,
      },
    });

    // Muscles: replace the set each run (cheap, exercise-scoped).
    await prisma.exerciseMuscle.deleteMany({ where: { exerciseId: exercise.id } });
    const muscleRows = [
      ...ex.primaryMuscles.map((muscleId) => ({ exerciseId: exercise.id, muscleId, role: "PRIMARY" as const })),
      ...ex.secondaryMuscles
        .filter((m) => !ex.primaryMuscles.includes(m))
        .map((muscleId) => ({ exerciseId: exercise.id, muscleId, role: "SECONDARY" as const })),
    ];
    if (muscleRows.length) {
      await prisma.exerciseMuscle.createMany({ data: muscleRows, skipDuplicates: true });
    }

    // Media: replace each run.
    await prisma.exerciseMedia.deleteMany({ where: { exerciseId: exercise.id } });
    if (ex.media.length) {
      await prisma.exerciseMedia.createMany({
        data: ex.media.map((m) => ({
          exerciseId: exercise.id,
          kind: m.kind as never,
          url: m.url,
          width: m.width,
          height: m.height,
          sortOrder: m.sortOrder,
        })),
      });
    }

    count++;
    if (count % 150 === 0) console.log(`  ...${count}/${exercises.length} exercises`);
  }
  console.log(`Exercises: upserted ${count}.`);
}

async function main() {
  await seedTaxonomy();
  await seedExercises();
  await seedEvidence();
  await seedPrinciples();
  await seedCuratedExerciseContent();
  await seedFlagshipProgram();

  const [muscles, equipment, patterns, exercises, evidence, principles, templates] = await Promise.all([
    prisma.muscle.count(),
    prisma.equipment.count(),
    prisma.movementPattern.count(),
    prisma.exercise.count(),
    prisma.evidenceSource.count(),
    prisma.trainingPrinciple.count(),
    prisma.workoutTemplate.count(),
  ]);
  console.log({ muscles, equipment, patterns, exercises, evidence, principles, templates });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
