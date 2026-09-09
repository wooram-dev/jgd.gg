import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function assertTestDatabase(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.slice(1);
  if (!/_test(?:_worker_\d+)?$/.test(databaseName)) {
    throw new Error("DATABASE_URL_TEST must name a dedicated database ending in _test.");
  }
  if (databaseUrl === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST must not equal DATABASE_URL.");
  }
}

export default function setupIntegrationDatabase(): void {
  if (process.env.ALLOW_TEST_DATABASE_RESET !== "true") {
    throw new Error("ALLOW_TEST_DATABASE_RESET=true is required for integration tests.");
  }
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST is required for PostgreSQL integration tests.");
  }
  assertTestDatabase(databaseUrl);

  const prismaCli = fileURLToPath(
    new URL("../../node_modules/prisma/build/index.js", import.meta.url),
  );
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
