import { defineConfig } from "@playwright/test";

const webOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:8080";

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: true,
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: webOrigin,
    browserName: "chromium",
    headless: true,
    viewport: { width: 390, height: 720 },
    screenshot: "off",
    video: "off",
    trace: "off",
    launchOptions: {
      args: ["--disable-dev-shm-usage"],
    },
  },
});
