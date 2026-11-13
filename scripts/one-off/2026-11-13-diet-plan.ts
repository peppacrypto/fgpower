/**
 * One-off, 2026-11-13: loads a diet plan (Dieta, /app/dieta) as the active plan of the account with the given
 * e-mail, replacing the one it has. The plan is a JSON file checked by the same schema the app reads plans with
 * (src/lib/validation/diet-plan.ts); nobody's plan lives in the repo — it comes from the command line, as a path or
 * on stdin ("-"), which is how it reaches the production container. Days already marked keep what they logged.
 * Idempotent. Dry run by default:
 *
 *   npx tsx scripts/one-off/2026-11-13-diet-plan.ts <plan.json> <email>            # checks it, shows what it would do
 *   npx tsx scripts/one-off/2026-11-13-diet-plan.ts <plan.json> <email> --apply    # saves it
 *   ssh railway-web -- "npx tsx scripts/one-off/2026-11-13-diet-plan.ts - <email> --apply" < plan.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { saveDietPlan } from "@/lib/diet/save-plan";
import { planItems, planTotals } from "@/lib/diet/plan";
import { describeDietPlanIssues, dietPlanSchema } from "@/lib/validation/diet-plan";

const USAGE = "usage: npx tsx scripts/one-off/2026-11-13-diet-plan.ts <plan.json | -> <email> [--apply]";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readPlanText(source: string): string {
  if (source !== "-") {
    try {
      return readFileSync(source, "utf8");
    } catch (err) {
      fail(`cannot read ${source}: ${(err as Error).message}`);
    }
  }
  if (process.stdin.isTTY) fail(`"-" reads the plan from stdin: pipe it in (... - <email> < plan.json)\n${USAGE}`);
  return readFileSync(0, "utf8");
}

const n = (x: number) => Math.round(x * 10) / 10;

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));
  const unknown = flags.filter((f) => f !== "--apply");
  if (unknown.length > 0 || positional.length !== 2) fail(USAGE);
  const apply = flags.includes("--apply");
  const [source, emailArg] = positional;
  const email = emailArg.trim().toLowerCase();

  let json: unknown;
  try {
    json = JSON.parse(readPlanText(source));
  } catch (err) {
    fail(`not JSON: ${(err as Error).message}`);
  }
  const parsed = dietPlanSchema.safeParse(json);
  if (!parsed.success) fail(`the plan does not pass the app's schema:\n  ${describeDietPlanIssues(parsed.error).join("\n  ")}`);
  const plan = parsed.data;

  const items = planItems(plan.meals);
  const alternatives = items.reduce((sum, i) => sum + (i.alternatives?.length ?? 0), 0);
  const sum = planTotals(plan.meals);
  const t = plan.targets;
  console.log(`Plan "${plan.title}"${plan.version ? ` (${plan.version})` : ""}: ${plan.meals.length} meals, ${items.length} items, ${alternatives} alternative(s), ${plan.swaps.length} swaps, ${plan.rules.length} rules.`);
  console.log(`  targets:         ${t.kcal} kcal · ${t.protein} g protein · ${t.carbs} g carbs · ${t.fat} g fat${t.fiber != null ? ` · ${t.fiber} g fiber` : ""}`);
  console.log(`  items add up to: ${n(sum.kcal)} kcal · ${n(sum.protein)} g protein · ${n(sum.carbs)} g carbs · ${n(sum.fat)} g fat (each item itself)`);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!user) fail(`no account with the e-mail ${email}`);
  const [current, markedDays] = await Promise.all([
    prisma.dietPlan.findUnique({ where: { userId: user.id }, select: { title: true, version: true, updatedAt: true } }),
    prisma.dietLog.groupBy({ by: ["day"], where: { userId: user.id } }).then((rows) => rows.length),
  ]);
  console.log(`Account: ${user.name} <${user.email}>`);
  console.log(
    current
      ? `  replaces "${current.title}"${current.version ? ` (${current.version})` : ""}, saved ${current.updatedAt.toISOString()}; ${markedDays} marked day(s) stay as logged`
      : "  has no plan yet: this one becomes it",
  );

  if (!apply) {
    console.log("Dry run: nothing written. Add --apply to save it.");
    return;
  }
  const saved = await saveDietPlan(user.id, plan);
  console.log(`Saved (${current ? "replaced" : "created"}): the active plan of ${user.email}, ${saved.updatedAt.toISOString()}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
