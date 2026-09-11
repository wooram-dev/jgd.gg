import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { completeGameSchema } from "@/features/number-click/schemas/api";
import {
  buildCompleteResponse,
  completeGameSessionTransaction,
} from "@/features/number-click/server/complete-service";
import {
  createGameSession,
  startGameSession,
} from "@/features/number-click/server/session-service";
import { parseJson } from "@/lib/http/request";
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
    expect(
      await database.gameSession.findUnique({
        where: { id: first.session.id },
        select: { createdAt: true, readyExpiresAt: true },
      }),
    ).toEqual({
      createdAt,
      readyExpiresAt: new Date(createdAt.getTime() + 60_000),
    });
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

  it("오클릭을 서버에서 계산해 500ms 페널티로 저장한다", async () => {
    const user = await createTestUser(database, "mistake-user");
    const session = await createPlayingSession(user.id);
    const result = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId: session.session.id,
      completion: {
        clientElapsedMs: 4_000,
        events: [{ value: 2, elapsedMs: 100 }, ...validEvents()],
      },
      now: completedAt,
    });

    expect(result.ok).toBe(true);
    expect(
      await database.gameRecord.findUnique({ where: { sessionId: session.session.id } }),
    ).toMatchObject({
      durationMs: 4_000,
      mistakeCount: 1,
      penaltyMs: 500,
      scoreValue: 4_500,
      clickCount: 26,
    });
  });

  it("READY 만료 시 EXPIRED로 전환하고 시작을 거부한다", async () => {
    const user = await createTestUser(database, "ready-expiry-user");
    const created = await createGameSession(database, {
      userId: user.id,
      idempotencyKey: randomUUID(),
      now: createdAt,
    });

    const result = await startGameSession(database, {
      userId: user.id,
      sessionId: created.session.id,
      now: new Date(createdAt.getTime() + 60_000),
    });

    expect(result.ok ? null : [result.error.status, result.error.code]).toEqual([
      410,
      "SESSION_EXPIRED",
    ]);
    expect(
      await database.gameSession.findUnique({ where: { id: created.session.id } }),
    ).toMatchObject({ status: "EXPIRED", terminalReason: "READY_EXPIRED" });
  });

  it("READY session 완료를 거부하고 session을 유지한다", async () => {
    const user = await createTestUser(database, "ready-complete-user");
    const created = await createGameSession(database, {
      userId: user.id,
      idempotencyKey: randomUUID(),
      now: createdAt,
    });

    const result = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId: created.session.id,
      completion: { clientElapsedMs: 4_000, events: validEvents() },
      now: completedAt,
    });

    expect(result.ok ? null : [result.error.status, result.error.code]).toEqual([
      409,
      "SESSION_NOT_PLAYING",
    ]);
    expect(
      await database.gameSession.findUnique({ where: { id: created.session.id } }),
    ).toMatchObject({ status: "READY", terminalReason: null });
    expect(await database.gameRecord.count({ where: { sessionId: created.session.id } })).toBe(0);
  });

  it("PLAYING 만료 뒤 완료를 거부하고 기록을 만들지 않는다", async () => {
    const user = await createTestUser(database, "playing-expiry-user");
    const session = await createPlayingSession(user.id);
    const result = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId: session.session.id,
      completion: { clientElapsedMs: 4_000, events: validEvents() },
      now: new Date(startedAt.getTime() + 300_001),
    });

    expect(result.ok ? null : [result.error.status, result.error.code]).toEqual([
      410,
      "SESSION_EXPIRED",
    ]);
    expect(
      await database.gameSession.findUnique({ where: { id: session.session.id } }),
    ).toMatchObject({ status: "EXPIRED", terminalReason: "PLAYING_EXPIRED" });
    expect(await database.gameRecord.count({ where: { sessionId: session.session.id } })).toBe(0);
  });

  it("malformed 완료 payload는 400이고 PLAYING session을 소비하지 않는다", async () => {
    const user = await createTestUser(database, "malformed-user");
    const session = await createPlayingSession(user.id);
    const request = new Request("http://localhost/api/v1/game-sessions/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientElapsedMs: 4_000,
        events: validEvents(),
        finalMs: 1,
      }),
    });

    await expect(parseJson(request, completeGameSchema, 16_384)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
    expect(
      await database.gameSession.findUnique({ where: { id: session.session.id } }),
    ).toMatchObject({ status: "PLAYING", terminalReason: null });
    expect(await database.gameRecord.count({ where: { sessionId: session.session.id } })).toBe(0);
  });

  it("BANNED 사용자의 session 생성과 완료를 거부한다", async () => {
    const banned = await createTestUser(database, "banned-create-user", { status: "BANNED" });

    await expect(
      createGameSession(database, {
        userId: banned.id,
        idempotencyKey: randomUUID(),
        now: createdAt,
      }),
    ).rejects.toMatchObject({ status: 403, code: "USER_BANNED" });

    const replayUser = await createTestUser(database, "banned-replay-user");
    const replayKey = randomUUID();
    await createGameSession(database, {
      userId: replayUser.id,
      idempotencyKey: replayKey,
      now: createdAt,
    });
    await database.user.update({ where: { id: replayUser.id }, data: { status: "BANNED" } });
    await expect(
      createGameSession(database, {
        userId: replayUser.id,
        idempotencyKey: replayKey,
        now: createdAt,
      }),
    ).rejects.toMatchObject({ status: 403, code: "USER_BANNED" });

    const active = await createTestUser(database, "banned-complete-user");
    const session = await createPlayingSession(active.id);
    await database.user.update({ where: { id: active.id }, data: { status: "BANNED" } });
    const result = await completeGameSessionTransaction(database, {
      userId: active.id,
      sessionId: session.session.id,
      completion: { clientElapsedMs: 4_000, events: validEvents() },
      now: completedAt,
    });

    expect(result.ok ? null : [result.error.status, result.error.code]).toEqual([
      403,
      "USER_BANNED",
    ]);
    expect(await database.gameRecord.count({ where: { sessionId: session.session.id } })).toBe(0);
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

  it("완료 후 rank 조회 실패가 이미 commit된 기록을 rollback하지 않는다", async () => {
    const user = await createTestUser(database, "rank-failure-user");
    const session = await createPlayingSession(user.id);
    const completed = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId: session.session.id,
      completion: { clientElapsedMs: 4_000, events: validEvents() },
      now: completedAt,
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error("Expected a successful completion");

    const querySpy = vi
      .spyOn(database, "$queryRaw")
      .mockRejectedValue(new Error("forced ranking lookup failure"));
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await buildCompleteResponse(database, {
        recordId: completed.recordId,
        userId: user.id,
        idempotentReplay: false,
        now: completedAt,
      });

      expect(response.meta).toMatchObject({
        idempotentReplay: false,
        rankLookupFailed: true,
      });
      expect(response.data.ranks).toEqual({ today: null, week: null, all: null });
      expect(logSpy).toHaveBeenCalledOnce();
    } finally {
      querySpy.mockRestore();
      logSpy.mockRestore();
    }

    expect(await database.gameRecord.count({ where: { sessionId: session.session.id } })).toBe(1);
    expect(
      await database.gameSession.findUnique({ where: { id: session.session.id } }),
    ).toMatchObject({ status: "COMPLETED", completedAt });
  });
});
