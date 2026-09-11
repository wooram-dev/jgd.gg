import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig, devices } from "@playwright/test";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

const databaseUrlTest = process.env.DATABASE_URL_TEST;
const authSecretTest = process.env.BETTER_AUTH_SECRET_TEST;
if (!databaseUrlTest || !authSecretTest) {
  throw new Error("DATABASE_URL_TEST and BETTER_AUTH_SECRET_TEST are required for E2E tests.");
}

const e2ePort = process.env.E2E_PORT ?? "3000";
if (!/^[1-9]\d{0,4}$/.test(e2ePort) || Number(e2ePort) > 65_535) {
  throw new Error("E2E_PORT must be a valid TCP port number.");
}

const e2eOrigin = `http://127.0.0.1:${e2ePort}`;
const serverEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
Object.assign(serverEnvironment, {
  NODE_ENV: "test",
  DATABASE_URL: databaseUrlTest,
  DIRECT_DATABASE_URL: databaseUrlTest,
  BETTER_AUTH_SECRET: authSecretTest,
  BETTER_AUTH_URL: e2eOrigin,
  DISCORD_CLIENT_ID: "mock-discord-client",
  DISCORD_CLIENT_SECRET: "mock-discord-secret",
  E2E_AUTH_MODE: "mock-discord",
});

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/helpers/e2e-global-setup.ts",
  use: {
    baseURL: e2eOrigin,
    trace: "retain-on-failure",
  },
  webServer:
    process.env.E2E_EXTERNAL_SERVER === "true"
      ? undefined
      : {
          command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${e2ePort}`,
          url: `${e2eOrigin}/games/number-click`,
          env: serverEnvironment,
          reuseExistingServer: false,
          timeout: 120_000,
        },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "compact-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 700 } },
    },
  ],
});
