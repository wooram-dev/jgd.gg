import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

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
const serverEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrlTest,
  DIRECT_DATABASE_URL: databaseUrlTest,
  BETTER_AUTH_SECRET: authSecretTest,
  BETTER_AUTH_URL: e2eOrigin,
  DISCORD_CLIENT_ID: "mock-discord-client",
  DISCORD_CLIENT_SECRET: "mock-discord-secret",
  E2E_AUTH_MODE: "mock-discord",
};

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForServer(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error("E2E Next.js server exited before becoming ready.");
    try {
      const response = await fetch(`${e2eOrigin}/games/number-click`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Timed out waiting for the E2E Next.js server.");
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    const taskkill = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForExit(taskkill);
    return;
  }

  child.kill("SIGTERM");
  await waitForExit(child);
}

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", e2ePort],
  { env: serverEnvironment, stdio: "pipe", windowsHide: true },
);
server.stdout?.pipe(process.stdout);
server.stderr?.pipe(process.stderr);

let stopping = false;
async function finish(exitCode: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  await stopServer(server);
  process.exitCode = exitCode;
}

process.once("SIGINT", () => void finish(130));
process.once("SIGTERM", () => void finish(143));

try {
  await waitForServer(server);
  const playwright = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
    env: { ...process.env, E2E_EXTERNAL_SERVER: "true", E2E_PORT: e2ePort },
    stdio: "inherit",
    windowsHide: true,
  });
  await finish(await waitForExit(playwright));
} catch (error) {
  await finish(1);
  throw error;
}
