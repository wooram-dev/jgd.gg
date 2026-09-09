import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { completeGameSessionTransaction } from "@/features/number-click/server/complete-service";
import {
  createGameSession,
  startGameSession,
} from "@/features/number-click/server/session-service";
import { cleanApplicationData, createTestDatabase, createTestUser } from "../../helpers/database";

const database = createTestDatabase();
const createdAt = new Date("2026-09-06T00:00:00.000Z");
const startedAt = new Date("2026-09-06T00:00:01.000Z");
const completedAt = new Date("2026-09-06T00:00:05.000Z");

function validEvents(durationMs = 4_000) {
  return Array.from({ length: 25 }, (_, index) => ({
    value: index + 1,
    elapsedMs: Math.round(((index + 1) / 25) * durationMs),
  }));
}

async function createPlayingSession(userId: string) {
  const created = await createGameSession(database, {
    userId,
    idempotencyKey: randomUUID(),
    now: createdAt,
  });
  const started = await startGameSession(database, {
    userId,
    sessionId: created.session.id,
    now: startedAt,
  });
  expect(started.ok).toBe(true);
  return created;
}

beforeEach(async () => {
  await cleanApplicationData(database);
});

afterAll(async () => {
  await database.$disconnect();
});

describe("number-click session API application services", () => {
  it("GameSession 생성 시 READY와 1~25 permutation을 저장·반환한다", async () => {
    const user = await createTestUser(database, "create-user");
    const idempotencyKey = randomUUID();
    const first = await createGameSession(database, {
      userId: user.id,
      idempotencyKey,
      now: createdAt,
    });
    const replay = await createGameSession(database, {
      userId: user.id,
      idempotencyKey,
      now: createdAt,
    });

    expect(first.session.status).toBe("READY");
    expect([...first.board].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
    expect(replay.session.id).toBe(first.session.id);
    expect(replay.idempotentReplay).toBe(true);
    expect(await database.gameSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it("정상 기록을 서버 계산값으로 저장한다", async () => {
    const user = await createTestUser(database, "complete-user");
    const session = await createPlayingSession(user.id);
    const result = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId: session.session.id,
      completion: { clientElapsedMs: 4_000, events: validEvents() },
      now: completedAt,
    });

    expect(result.ok).toBe(true);
    const record = await database.gameRecord.findUnique({
      where: { sessionId: session.session.id },
    });
    expect(record).toMatchObject({
      durationMs: 4_000,
      mistakeCount: 0,
      penaltyMs: 0,
      scoreValue: 4_000,
      clickCount: 25,
    });
    expect(
      (await database.gameSession.findUnique({ where: { id: session.session.id } }))?.status,
    ).toBe("COMPLETED");
  });

  it("없는 session과 다른 사용자 session을 같은 404로 숨긴다", async () => {
    const owner = await createTestUser(database, "owner-user");
    const attacker = await createTestUser(database, "attacker-user");
    const session = await createPlayingSession(owner.id);
    const completion = { clientElapsedMs: 4_000, events: validEvents() };

    const missing = await completeGameSessionTransaction(database, {
      userId: attacker.id,
      sessionId: randomUUID(),
      completion,
      now: completedAt,
    });
    const foreign = await completeGameSessionTransaction(database, {
      userId: attacker.id,
      sessionId: session.session.id,
      completion,
      now: completedAt,
    });
    expect(missing.ok ? null : [missing.error.status, missing.error.code]).toEqual([
      404,
      "NOT_FOUND",
    ]);
    expect(foreign.ok ? null : [foreign.error.status, foreign.error.code]).toEqual([
      404,
      "NOT_FOUND",
    ]);
  });

  it("중복 완료와 동시 완료가 GameRecord 한 건을 반환한다", async () => {
    const user = await createTestUser(database, "duplicate-user");
    const session = await createPlayingSession(user.id);
    const input = {
      userId: user.id,
      sessionId: session.session.id,
      completion: { clientElapsedMs: 4_000, events: validEvents() },
      now: completedAt,
    };
    const [first, second] = await Promise.all([
      completeGameSessionTransaction(database, input),
      completeGameSessionTransaction(database, input),
    ]);
    const retry = await completeGameSessionTransaction(database, input);

    expect(first.ok && second.ok && retry.ok).toBe(true);
    if (!first.ok || !second.ok || !retry.ok) throw new Error("Expected successful completions");
    expect(new Set([first.recordId, second.recordId, retry.recordId]).size).toBe(1);
    expect(retry.idempotentReplay).toBe(true);
    expect(await database.gameRecord.count({ where: { sessionId: session.session.id } })).toBe(1);
  });

  it("비정상적으로 짧은 기록을 REJECTED로 소비하고 저장하지 않는다", async () => {
    const user = await createTestUser(database, "rejected-user");
    const session = await createPlayingSession(user.id);
    const result = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId: session.session.id,
      completion: { clientElapsedMs: 2_999, events: validEvents(2_999) },
      now: new Date("2026-09-06T00:00:04.000Z"),
    });

    expect(result.ok ? null : result.error.code).toBe("RESULT_TOO_FAST");
    expect(await database.gameRecord.count({ where: { sessionId: session.session.id } })).toBe(0);
    expect(
      (await database.gameSession.findUnique({ where: { id: session.session.id } }))?.status,
    ).toBe("REJECTED");
  });
});
