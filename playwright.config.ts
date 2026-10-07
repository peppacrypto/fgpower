import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // Fail fast if the e2e database is unreachable, instead of dozens of tests
  // skipping in silence (A-092). See e2e/global-setup.ts and e2e/db.ts.
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3055",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3055",
        url: "http://localhost:3055",
        reuseExistingServer: true,
        timeout: 60_000,
        // The re-engagement specs (27, 30) exercise reminders, which the app only
        // offers when the scheduler is configured (A-048): REMINDER_SCHEDULER=on +
        // CRON_SECRET + VAPID keys. CRON_SECRET and the VAPID keys live in .env;
        // this flips the scheduler on for the test server. Merged over process.env.
        env: { REMINDER_SCHEDULER: "on" },
      },
});
