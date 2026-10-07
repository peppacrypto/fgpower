import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Native Vite tsconfig-paths resolution (Vite 8 `resolve.tsconfigPaths`),
    // which replaces the redundant vite-tsconfig-paths plugin Vitest warned
    // about. It reads tsconfig.json's `paths` ("@/*" -> "./src/*") so the test
    // suite resolves the same module specifiers as the app build.
    tsconfigPaths: true,
    alias: {
      // "server-only" throws by design when imported outside Next's server
      // bundler (that's the whole point of the package) — stub it so
      // integration tests can import our data/auth modules under Vitest.
      "server-only": path.resolve(import.meta.dirname, "src/lib/testing/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
