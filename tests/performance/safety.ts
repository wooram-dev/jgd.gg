import { randomUUID } from "node:crypto";

function parseDatabaseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    // URL's native error includes its input, which may contain credentials.
    throw new Error("Invalid database URL configuration.");
  }
}

export function performanceTarget(
  testUrl: string | undefined,
  developmentUrl: string | undefined,
  allowed: string | undefined,
) {
  if (!testUrl || allowed !== "true")
    throw new Error(
      "Performance smoke requires DATABASE_URL_TEST and ALLOW_TEST_DATABASE_RESET=true.",
    );
  const target = parseDatabaseUrl(testUrl);
  if (
    target.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
  ) {
    throw new Error("Performance smoke only supports a local PostgreSQL test database.");
  }
  if (!/^[a-zA-Z0-9_]+_test(?:_worker_\d+)?$/.test(target.pathname.slice(1)))
    throw new Error("A dedicated _test database is required.");
  if (developmentUrl) {
    const development = parseDatabaseUrl(developmentUrl);
    const sameLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(development.hostname);
    if (
      sameLocalHost &&
      (target.port || "5432") === (development.port || "5432") &&
      target.pathname === development.pathname
    ) {
      throw new Error("Development and performance databases must differ, including URL aliases.");
    }
  }
  // Ignore caller-supplied search_path/options; the runner owns one new schema only.
  target.search = "";
  const schema = `jgd_perf_${randomUUID().replaceAll("-", "")}`;
  target.searchParams.set("schema", schema);
  target.searchParams.set(
    "options",
    `-csearch_path=${schema} -cstatement_timeout=120000 -clock_timeout=10000`,
  );
  return { url: target, schema };
}

export function assertOwnedPerformanceSchema(
  actualDatabase: string,
  actualSchema: string,
  expectedDatabase: string,
  expectedSchema: string,
) {
  if (
    !/^jgd_perf_[0-9a-f]{32}$/.test(expectedSchema) ||
    actualSchema !== expectedSchema ||
    actualDatabase !== expectedDatabase
  ) {
    throw new Error("Refusing to change a database/schema outside this performance run.");
  }
}

export function percentile(values: number[], percentile: number) {
  if (!values.length || percentile <= 0 || percentile > 1)
    throw new Error("Invalid percentile input.");
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * percentile) - 1];
}
