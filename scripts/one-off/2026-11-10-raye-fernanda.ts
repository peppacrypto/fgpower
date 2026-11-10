/**
 * One-off, 2026-11-10: Fernanda's own copy of RAYE gets the two corrections she wrote in her notes after workout A
 * (2026-11-09): "o avanço com halteres deveria ser afundo estático com halteres; a cadeira abdutora do bi-set deveria
 * ser abdução no Cross com o pé atrás". The template was corrected in the seed; a user's copy is not touched by a
 * reseed, so this swaps the two rows in her program. Idempotent. Dry run by default:
 *
 *   npx tsx scripts/one-off/2026-11-10-raye-fernanda.ts            # shows what it would change
 *   npx tsx scripts/one-off/2026-11-10-raye-fernanda.ts --apply    # changes it
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const APPLY = process.argv.includes("--apply");
const EMAIL = "nanda.raye22@gmail.com";
const SWAPS = [
  { from: "dumbbell-lunges", to: "dumbbell-static-lunge", notes: "Afundo estático com halteres. A ficha pede 3 ou 4 séries." },
  { from: "thigh-abductor", to: "cable-hip-abduction-back", notes: "Abdução no cross com o pé atrás, em bi-série com os glúteos. A ficha pede 3 ou 4 séries." },
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, name: true } });
  if (!user) throw new Error(`no user ${EMAIL}`);
  const targets = await prisma.exercise.findMany({ where: { slug: { in: SWAPS.map((s) => s.to) } }, select: { id: true, slug: true } });
  if (targets.length !== SWAPS.length) throw new Error("the new exercises are not in the database yet: deploy and reseed first");
  const idOf = new Map(targets.map((t) => [t.slug, t.id]));
  const programs = await prisma.userProgram.findMany({
    where: { userId: user.id, name: "RAYE" },
    select: { id: true, status: true, days: { where: { dayIndex: 0 }, select: { name: true, exercises: { select: { id: true, sortOrder: true, exercise: { select: { slug: true } } } } } } },
  });
  let changed = 0;
  for (const p of programs) {
    for (const day of p.days) {
      for (const row of day.exercises) {
        const swap = SWAPS.find((s) => s.from === row.exercise.slug);
        if (!swap) continue;
        console.log(`${p.id} (${p.status}) ${day.name} #${row.sortOrder}: ${swap.from} -> ${swap.to}`);
        if (APPLY) await prisma.userProgramExercise.update({ where: { id: row.id }, data: { exerciseId: idOf.get(swap.to)!, notes: swap.notes } });
        changed++;
      }
    }
  }
  console.log(`${user.name}: ${programs.length} RAYE program(s), ${changed} row(s) ${APPLY ? "changed" : "to change (dry run)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
