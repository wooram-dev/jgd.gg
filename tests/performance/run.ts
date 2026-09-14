import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import sharp from "sharp";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { NUMBER_CLICK_RULES_SNAPSHOT } from "@/features/number-click/domain/rules";
import {
  buildCompleteResponse,
  completeGameSessionTransaction,
} from "@/features/number-click/server/complete-service";
import {
  createGameSession,
  startGameSession,
} from "@/features/number-click/server/session-service";
import { getNumberClickStats } from "@/features/number-click/server/stats-service";
import { getPointOverview } from "@/features/points/server/points-service";
import { POINTS_POLICY_VERSION } from "@/features/points/domain/policy";
import { getNumberClickRanking } from "@/features/ranking/server/ranking-service";
import { prepareStoryImage } from "@/features/stories/server/image";
import { assertOwnedPerformanceSchema, performanceTarget, percentile } from "./safety";

const root = fileURLToPath(new URL("../../", import.meta.url));
for (const filename of [".env.local", ".env"]) {
  const filenamePath = path.join(root, filename);
  if (existsSync(filenamePath)) loadEnvFile(filenamePath);
}
const quick = process.argv.includes("--quick");
if (process.argv.slice(2).some((arg) => arg !== "--quick"))
  throw new Error("Only --quick is supported.");
const { url, schema } = performanceTarget(
  process.env.DATABASE_URL_TEST,
  process.env.DATABASE_URL,
  process.env.ALLOW_TEST_DATABASE_RESET,
);
const users = quick ? 1_000 : 100_000;
const records = users * 10;
const repetitions = quick ? 3 : 20;
const now = new Date("2026-09-17T06:00:00.000Z");
const viewerId = `perf-user-${String(users - 1).padStart(6, "0")}`;
const pool = new pg.Pool({
  connectionString: url.toString(),
  max: 8,
  connectionTimeoutMillis: 5_000,
});
const database = new PrismaClient({
  adapter: new PrismaPg(pool, { schema }),
  log: [{ emit: "event", level: "query" }],
});
let queries: Prisma.QueryEvent[] = [];
database.$on("query", (event) => queries.push(event));
const outputDirectory = path.join(root, ".performance", schema);
const backupPath = path.join(outputDirectory, "synthetic.dump");
const results: Array<{
  name: string;
  firstMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  queryCount: number;
  targetMs: number | null;
  passed: boolean | null;
  plans: unknown[];
}> = [];
const report: Record<string, unknown> = {
  scope: "local synthetic service/DB smoke; not a production latency certification",
  quick,
  users,
  records,
  repetitions,
  warmups: 2,
  fixtureNow: now.toISOString(),
  environment: {
    node: process.version,
    os: `${os.platform()} ${os.release()}`,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
  },
  results,
};
let created = false;
let phase = "initialize";
const quotedSchema = `"${schema}"`; // schema is generated and guarded, never caller SQL.

function postgresBinary(name: string) {
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  const directory =
    process.env.PG_BIN_DIR ??
    (process.platform === "win32" ? "C:/Program Files/PostgreSQL/18/bin" : "");
  return directory ? path.join(directory, executable) : executable;
}
const pgEnvironment = {
  ...process.env,
  PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
  PGPORT: url.port || "5432",
  PGDATABASE: url.pathname.slice(1),
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGOPTIONS: `-csearch_path=${schema} -cstatement_timeout=120000 -clock_timeout=10000`,
};
function runBinary(binary: string, args: string[], env: NodeJS.ProcessEnv = pgEnvironment) {
  // Credentials are passed only through the child environment. Never print error/stderr payloads.
  execFileSync(binary, args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: "pipe",
    timeout: 300_000,
  });
}
async function saveReport() {
  await writeFile(
    path.join(outputDirectory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
async function ownedSchema() {
  const { rows } = await pool.query<{ database: string; schema: string }>(
    "SELECT current_database() AS database, current_schema() AS schema",
  );
  assertOwnedPerformanceSchema(rows[0].database, rows[0].schema, url.pathname.slice(1), schema);
}
async function measure(
  name: string,
  prepare: () => Promise<() => Promise<unknown>>,
  targetMs: number | null = null,
) {
  phase = name;
  const durations: number[] = [];
  let firstMs = 0;
  let captured: Prisma.QueryEvent[] = [];
  for (let n = 0; n < repetitions + 2; n++) {
    const execute = await prepare();
    queries = [];
    const start = performance.now();
    await execute();
    const duration = performance.now() - start;
    if (n === 0) firstMs = duration;
    if (n >= 2) durations.push(duration);
    if (n === 2) captured = [...queries];
  }
  const plans: unknown[] = [];
  // Explain the exact SQL emitted by the service, not a separately maintained approximation.
  for (const query of captured.filter(
    (event) => /\bSELECT\b/i.test(event.query) && !/FOR UPDATE/i.test(event.query),
  )) {
    const parameters: unknown = JSON.parse(query.params);
    assert(Array.isArray(parameters));
    const result = await pool.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.query}`,
      parameters,
    );
    plans.push({ sql: query.query, plan: result.rows[0]["QUERY PLAN"] });
  }
  const p95Ms = percentile(durations, 0.95);
  const result = {
    name,
    firstMs,
    p50Ms: percentile(durations, 0.5),
    p95Ms,
    maxMs: Math.max(...durations),
    queryCount: captured.length,
    targetMs,
    passed: targetMs === null ? null : p95Ms <= targetMs,
    plans,
  };
  results.push(result);
  console.log(
    `${name}: p50=${result.p50Ms.toFixed(1)}ms p95=${p95Ms.toFixed(1)}ms queries=${result.queryCount}${targetMs === null ? " (observation)" : result.passed ? " PASS" : " FAIL"}`,
  );
  await saveReport();
}

async function fingerprint() {
  const tables = [
    "_prisma_migrations",
    "user",
    "account",
    "session",
    "verification",
    "game",
    "game_session",
    "game_record",
    "point_account",
    "point_transaction",
    "story",
  ];
  const data: Record<string, unknown> = {};
  for (const table of tables) {
    const result = await pool.query(
      `SELECT count(*)::text AS count, COALESCE(sum(hashtextextended(row_to_json(t)::text, 0)::numeric),0)::text AS checksum FROM ${quotedSchema}."${table}" t`,
    );
    data[table] = result.rows[0];
  }
  const objects = await pool.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname",
    [schema],
  );
  data.indexes = objects.rows;
  return data;
}

try {
  await mkdir(outputDirectory, { recursive: true });
  phase = "create isolated schema";
  await pool.query(`CREATE SCHEMA ${quotedSchema}`);
  created = true;
  await ownedSchema();
  phase = "migrate isolated schema";
  runBinary(
    process.execPath,
    [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    {
      ...process.env,
      DATABASE_URL: url.toString(),
      DIRECT_DATABASE_URL: url.toString(),
    },
  );
  report.migrations = (await readdir(path.join(root, "prisma/migrations")))
    .filter((name) => /^\d+_/.test(name))
    .sort();
  report.databaseSettings = (
    await pool.query(
      "SELECT name, setting, unit FROM pg_settings WHERE name = ANY($1::text[]) ORDER BY name",
      [
        [
          "server_version",
          "shared_buffers",
          "work_mem",
          "effective_cache_size",
          "max_connections",
          "max_parallel_workers_per_gather",
          "fsync",
          "synchronous_commit",
        ],
      ],
    )
  ).rows;
  console.log(
    `Isolated fixture: ${users.toLocaleString()} synthetic users / ${records.toLocaleString()} records.`,
  );
  phase = "seed synthetic records";
  const seedStart = performance.now();
  const statements = (await readFile(new URL("./fixture.sql", import.meta.url), "utf8"))
    .split(";")
    .map((sql) => sql.trim())
    .filter(Boolean);
  const bindings: unknown[][] = [
    [users],
    [records, now],
    [
      JSON.stringify(NUMBER_CLICK_RULES_SNAPSHOT),
      JSON.stringify({ schemaVersion: 1, board: Array.from({ length: 25 }, (_, n) => n + 1) }),
    ],
    [],
    [POINTS_POLICY_VERSION, new Date("2026-09-11T16:12:00.000Z")],
    [],
    [],
  ];
  assert.equal(statements.length, bindings.length);
  for (let index = 0; index < statements.length; index++) {
    await pool.query(statements[index], bindings[index]);
    console.log(`Fixture stage ${index + 1}/${statements.length} complete.`);
  }
  await pool.query(
    `ANALYZE ${quotedSchema}."user", ${quotedSchema}.game, ${quotedSchema}.game_session, ${quotedSchema}.game_record, ${quotedSchema}.point_account, ${quotedSchema}.point_transaction`,
  );
  report.seedMs = performance.now() - seedStart;
  assert.equal(await database.user.count(), users);
  assert.equal(await database.gameRecord.count(), records);
  report.pointTransactions = await database.pointTransaction.count();
  const original = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "purple" },
  })
    .png()
    .toBuffer();
  await database.story.create({
    data: {
      ...(await prepareStoryImage(original, "image/png")),
      userId: viewerId,
      uploadKey: crypto.randomUUID(),
      createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
  });
  const balances = await pool.query(
    "SELECT count(*)::int AS mismatches FROM point_account a LEFT JOIN (SELECT account_user_id, sum(amount) AS balance FROM point_transaction GROUP BY account_user_id) p ON p.account_user_id = a.user_id WHERE a.balance <> COALESCE(p.balance,0)",
  );
  assert.equal(balances.rows[0].mismatches, 0);

  for (const period of ["today", "week", "all"] as const) {
    for (const member of [false, true]) {
      await measure(
        `ranking.${period}.${member ? "member-outside-top100" : "guest"}`,
        async () => async () => {
          const data = await getNumberClickRanking(database, {
            period,
            limit: 100,
            offset: 0,
            viewerId: member ? viewerId : null,
            now,
          });
          assert(data && data.items.length === 100 && data.pagination.hasMore);
          if (member) assert(data.viewer && data.viewer.rank > 100);
        },
        500,
      );
    }
  }
  await measure(
    "personal.stats",
    async () => async () => assert(await getNumberClickStats(database, { userId: viewerId, now })),
  );
  await measure(
    "points.overview",
    async () => async () =>
      assert.equal((await getPointOverview(database, { userId: viewerId })).unit, "P"),
  );

  let completionIndex = 0;
  let completedRecord: { recordId: string; userId: string } | undefined;
  let replay: (() => Promise<unknown>) | undefined;
  await measure(
    "completion.transaction-with-points",
    async () => {
      const userId = `perf-user-${String(++completionIndex).padStart(6, "0")}`;
      const created = await createGameSession(database, {
        userId,
        idempotencyKey: crypto.randomUUID(),
        now: new Date(now.getTime() - 5000),
      });
      const started = await startGameSession(database, {
        userId,
        sessionId: created.session.id,
        now: new Date(now.getTime() - 4000),
      });
      assert(started.ok);
      const input = {
        userId,
        sessionId: created.session.id,
        now,
        completion: {
          clientElapsedMs: 4000,
          events: Array.from({ length: 25 }, (_, n) => ({
            value: n + 1,
            elapsedMs: (n + 1) * 160,
          })),
        },
      };
      replay = () => completeGameSessionTransaction(database, input);
      return async () => {
        const completed = await completeGameSessionTransaction(database, input);
        assert(completed.ok && !completed.idempotentReplay);
        completedRecord = { recordId: completed.recordId, userId };
      };
    },
    800,
  );
  const beforeReplay = await database.pointTransaction.count();
  assert.equal(beforeReplay, Number(report.pointTransactions) + completionIndex);
  assert(replay);
  await Promise.all([replay(), replay()]);
  assert.equal(await database.pointTransaction.count(), beforeReplay);
  assert.equal(await database.gameRecord.count(), records + completionIndex);
  report.replayIntegrity = "PASS";
  assert(completedRecord);
  const responseInput = { ...completedRecord, idempotentReplay: false, now };
  await measure("completion.response-after-commit", async () => async () => {
    const response = await buildCompleteResponse(database, responseInput);
    assert.equal(response.data.points.awarded, 10);
  });

  phase = "backup and restore synthetic schema";
  console.log("Verifying schema backup/restore with row checksums, indexes and account trigger.");
  const before = await fingerprint();
  const dumpStart = performance.now();
  runBinary(postgresBinary("pg_dump"), [
    "--format=custom",
    `--schema=${schema}`,
    `--file=${backupPath}`,
    "--no-owner",
    "--no-privileges",
  ]);
  const dumpMs = performance.now() - dumpStart;
  // Only this invocation's fresh, synthetic schema is removed. Never public or a supplied name.
  await ownedSchema();
  await pool.query(`DROP SCHEMA ${quotedSchema} CASCADE`);
  created = false;
  const restoreStart = performance.now();
  runBinary(postgresBinary("pg_restore"), [
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
    `--dbname=${url.pathname.slice(1)}`,
    backupPath,
  ]);
  created = true;
  await ownedSchema();
  const restoreMs = performance.now() - restoreStart;
  assert.deepEqual(await fingerprint(), before);
  const restoredUser = await database.user.create({
    data: {
      id: "perf-restored-trigger",
      name: "Synthetic restore check",
      email: "perf-restore@discord.placeholder.invalid",
      discordUsername: "perf-restore",
      discordDisplayName: "Synthetic restore check",
    },
  });
  assert.equal(
    (await database.pointAccount.findUniqueOrThrow({ where: { userId: restoredUser.id } })).balance,
    0,
  );
  report.backupRestore = {
    result: "PASS",
    dumpMs,
    restoreMs,
    verification: "all table row counts/checksums, all index definitions, new-user account trigger",
    fingerprint: before,
  };
  await unlink(backupPath);
  report.status = results.some((result) => result.passed === false)
    ? "TARGET_EXCEEDED"
    : quick
      ? "QUICK_SMOKE_PASS"
      : "LOCAL_SMOKE_PASS";
  if (results.some((result) => result.passed === false)) process.exitCode = 1;
} catch (error) {
  report.status = "ERROR";
  report.failure = {
    phase,
    name: error instanceof Error ? error.name : "Unknown",
    code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
  };
  console.error(`Performance smoke failed during ${phase}. See sanitized report metadata.`);
  process.exitCode = 1;
} finally {
  try {
    if (created) {
      await ownedSchema();
      await pool.query(`DROP SCHEMA ${quotedSchema} CASCADE`);
      report.cleanup = "only this run's synthetic schema removed";
    }
  } catch {
    report.cleanup = "FAILED: isolated schema retained for inspection";
    process.exitCode = 1;
  }
  await database.$disconnect();
  await pool.end();
  await saveReport();
  console.log(`Report: ${path.relative(root, path.join(outputDirectory, "report.json"))}`);
}
