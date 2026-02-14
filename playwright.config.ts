import { defineConfig, devices } from "@playwright/test";

const webServerCommand =
  process.platform === "win32"
    ? "pnpm.cmd --filter @agentifui/web dev --webpack --port 3000"
    : "pnpm --filter @agentifui/web dev --webpack --port 3000";

export default defineConfig({
  testDir: "./apps/web/e2e",
  testIgnore: ["**/rbac/**", "**/tenant-switch.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
