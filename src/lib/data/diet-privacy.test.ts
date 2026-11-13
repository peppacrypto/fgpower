import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Dieta is owner-only health data. Read from the source: the diet's reader
 * (lib/data/diet) is imported only by the owner's own screens and action, and
 * the diet tables are queried only by the modules that own them and the
 * owner's export — never by a public or social surface (/u, /t, the feed, OG
 * images, e-mails), which would have to import one of these to show it.
 */

const SRC = fileURLToPath(new URL("../..", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path] : [];
  });
}

const files = sources(SRC).map((path) => ({ rel: relative(SRC, path).split(sep).join("/"), text: readFileSync(path, "utf8") }));

describe("Dieta stays the owner's", () => {
  it("lib/data/diet is imported only by Dieta, Perfil (the user's own) and the diet action", () => {
    const importers = files.filter((f) => /from ["']@\/lib\/data\/diet["']/.test(f.text)).map((f) => f.rel);
    expect(importers.sort()).toEqual(["app/app/dieta/page.tsx", "app/app/profile/page.tsx", "lib/actions/diet.ts"]);
  });

  it("the diet tables are queried only by their own modules and the owner's export", () => {
    const queriers = files.filter((f) => /prisma\.diet(Plan|Log)\b/.test(f.text)).map((f) => f.rel);
    expect(queriers.sort()).toEqual(["lib/actions/diet.ts", "lib/data/account-export.ts", "lib/data/diet.ts", "lib/diet/save-plan.ts"]);
  });
});
