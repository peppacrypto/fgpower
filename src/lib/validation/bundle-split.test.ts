import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("zod-free bundle split (A-089)", () => {
  it("the *-constants modules never import zod", () => {
    for (const rel of [
      "src/lib/validation/program-builder-constants.ts",
      "src/lib/validation/preferences-constants.ts",
      "src/lib/validation/onboarding-constants.ts",
    ]) {
      expect(read(rel)).not.toMatch(/from ["']zod["']/);
    }
  });

  it("the workout + Settings client files import constants, not the zod schema modules", () => {
    expect(read("src/app/app/workout/[sessionId]/workout-execution-client.tsx")).toContain(
      "@/lib/validation/program-builder-constants",
    );
    expect(read("src/app/app/settings/workout-preferences-form.tsx")).toContain(
      "@/lib/validation/preferences-constants",
    );
    expect(read("src/app/app/settings/profile-form.tsx")).toContain(
      "@/lib/validation/onboarding-constants",
    );
    // ...and no longer pull the zod-carrying modules as a value import.
    expect(read("src/app/app/settings/workout-preferences-form.tsx")).not.toMatch(
      /from ["']@\/lib\/validation\/preferences["']/,
    );
  });
});
