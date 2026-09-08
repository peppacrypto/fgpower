import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" throws by design when imported outside Next's server
      // bundler (that's the whole point of the package) — stub it so
      // integration tests can import our data/auth modules under Vitest.
      "server-only": path.resolve(import.meta.dirname, "src/lib/testing/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
