import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  buildCompleteResponse,
  completeGameSessionTransaction,
} from "@/features/number-click/server/complete-service";
import {
  createGameSession,
  startGameSession,
} from "@/features/number-click/server/session-service";
import {
  PointLedgerIntegrityError,
  getPointOverview,
  invalidateGameRecord,
} from "@/features/points/server/points-service";
import { cleanApplicationData, createTestDatabase, createTestUser } from "../../helpers/database";

const database = createTestDatabase();

function validEvents(durationMs = 4_000) {
  return Array.from({ length: 25 }, (_, index) => ({
    value: index + 1,
    elapsedMs: Math.round(((index + 1) / 25) * durationMs),
  }));
}

async function createPlayingSession(userId: string, completedAt: Date) {
  const createdAt = new Date(completedAt.getTime() - 5_000);
  const startedAt = new Date(completedAt.getTime() - 4_000);
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
  return created.session.id;
}

async function completeAt(userId: string, completedAt: Date) {
  const sessionId = await createPlayingSession(userId, completedAt);
  const result = await completeGameSessionTransaction(database, {
    userId,
    sessionId,
    completion: { clientElapsedMs: 4_000, events: validEvents() },
    now: completedAt,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  return result;
}

beforeEach(async () => {
  await cleanApplicationData(database);
});

afterAll(async () => {
  await database.$disconnect();
});

describe("points ledger", () => {
  it("신규 사용자마다 0P 계정을 자동 생성하고 본인 조회 DTO를 반환한다", async () => {
    const user = await createTestUser(database, "points-account-user");

    expect(await database.pointAccount.findUnique({ where: { userId: user.id } })).toMatchObject({
      balance: 0,
    });
    await database.user.update({ where: { id: user.id }, data: { status: "BANNED" } });
    await expect(getPointOverview(database, { userId: user.id })).resolves.toEqual({
      balance: 0,
      unit: "P",
      transactions: [],
    });
  });

  it("정책 적용 뒤 유효한 공식 완료에 10P를 정확히 한 번 적립한다", async () => {
    const user = await createTestUser(database, "points-award-user");
    const completedAt = new Date("2026-09-12T00:00:05.000Z");
    const sessionId = await createPlayingSession(user.id, completedAt);
    const input = {
      userId: user.id,
      sessionId,
      completion: { clientElapsedMs: 4_000, events: validEvents() },
      now: completedAt,
    };
    const [first, second] = await Promise.all([
      completeGameSessionTransaction(database, input),
      completeGameSessionTransaction(database, input),
    ]);
    const retry = await completeGameSessionTransaction(database, input);

    expect(first.ok && second.ok && retry.ok).toBe(true);
    expect(await database.pointAccount.findUnique({ where: { userId: user.id } })).toMatchObject({
      balance: 10,
    });
    expect(await database.pointTransaction.count({ where: { accountUserId: user.id } })).toBe(1);
    const transaction = await database.pointTransaction.findFirstOrThrow({
      where: { accountUserId: user.id },
    });
    expect(transaction).toMatchObject({
      type: "EARN",
      reason: "NUMBER_CLICK_COMPLETION",
      amount: 10,
      balanceAfter: 10,
      policyVersion: "number-click-completion-v1",
    });
  });

  it("KST 하루 5회·50P 한도를 적용하고 다음 날 다시 적립한다", async () => {
    const user = await createTestUser(database, "points-limit-user");
    const dayOne = new Date("2026-09-12T01:00:05.000Z");
    const results = [];
    for (let index = 0; index < 6; index += 1) {
      results.push(await completeAt(user.id, new Date(dayOne.getTime() + index * 10_000)));
    }

    expect(await database.pointAccount.findUnique({ where: { userId: user.id } })).toMatchObject({
      balance: 50,
    });
    expect(await database.pointTransaction.count({ where: { accountUserId: user.id } })).toBe(5);
    const sixth = results[5];
    const sixthResponse = await buildCompleteResponse(database, {
      recordId: sixth.recordId,
      userId: user.id,
      idempotentReplay: false,
      now: new Date(dayOne.getTime() + 50_000),
    });
    expect(sixthResponse.data.points).toMatchObject({
      status: "DAILY_LIMIT_REACHED",
      awarded: 0,
      balance: 50,
      dailyLimit: 50,
    });

    const nextDay = await completeAt(user.id, new Date("2026-09-12T15:00:05.000Z"));
    const nextDayResponse = await buildCompleteResponse(database, {
      recordId: nextDay.recordId,
      userId: user.id,
      idempotentReplay: false,
      now: new Date("2026-09-12T15:00:05.000Z"),
    });
    expect(nextDayResponse.data.points).toMatchObject({
      status: "AWARDED",
      awarded: 10,
      balance: 60,
    });
  });

  it("정책 적용 전 기록과 연습·거절 기록에는 포인트를 만들지 않는다", async () => {
    const user = await createTestUser(database, "points-ineligible-user");
    const result = await completeAt(user.id, new Date("2026-09-11T14:59:59.999Z"));
    const response = await buildCompleteResponse(database, {
      recordId: result.recordId,
      userId: user.id,
      idempotentReplay: false,
      now: new Date("2026-09-11T14:59:59.999Z"),
    });

    expect(response.data.points).toMatchObject({ status: "NOT_ELIGIBLE", awarded: 0, balance: 0 });
    expect(await database.pointTransaction.count({ where: { accountUserId: user.id } })).toBe(0);

    const rejectedSession = await createPlayingSession(
      user.id,
      new Date("2026-09-12T00:00:05.000Z"),
    );
    const rejected = await completeGameSessionTransaction(database, {
      userId: user.id,
      sessionId: rejectedSession,
      completion: { clientElapsedMs: 2_999, events: validEvents(2_999) },
      now: new Date("2026-09-12T00:00:05.000Z"),
    });
    expect(rejected.ok).toBe(false);
    expect(await database.pointTransaction.count({ where: { accountUserId: user.id } })).toBe(0);
  });

  it("기록 무효화는 원본 적립을 보존하고 같은 양의 회수 row를 한 번 추가한다", async () => {
    const user = await createTestUser(database, "points-reversal-user");
    const completed = await completeAt(user.id, new Date("2026-09-12T02:00:05.000Z"));
    const invalidatedAt = new Date("2026-09-12T03:00:00.000Z");
    const first = await invalidateGameRecord(database, {
      gameRecordId: completed.recordId,
      reason: "manual-review",
      now: invalidatedAt,
    });
    const replay = await invalidateGameRecord(database, {
      gameRecordId: completed.recordId,
      reason: "ignored-replay",
      now: new Date(invalidatedAt.getTime() + 1_000),
    });

    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);
    expect(await database.pointAccount.findUnique({ where: { userId: user.id } })).toMatchObject({
      balance: 0,
    });
    expect(
      await database.pointTransaction.findMany({
        where: { accountUserId: user.id },
        orderBy: { createdAt: "asc" },
      }),
    ).toMatchObject([
      { type: "EARN", amount: 10, balanceAfter: 10 },
      {
        type: "REVERSAL",
        reason: "GAME_RECORD_INVALIDATION",
        amount: -10,
        balanceAfter: 0,
      },
    ]);
    expect(
      await database.gameRecord.findUnique({ where: { id: completed.recordId } }),
    ).toMatchObject({
      rankEligible: false,
      invalidatedAt,
      invalidatedReason: "manual-review",
    });
    const response = await buildCompleteResponse(database, {
      recordId: completed.recordId,
      userId: user.id,
      idempotentReplay: true,
      now: invalidatedAt,
    });
    expect(response.data.points).toMatchObject({
      status: "REVERSED",
      awarded: 0,
      balance: 0,
    });
  });

  it("잔액과 원장 합계가 다르면 새 완료와 적립을 함께 rollback한다", async () => {
    const user = await createTestUser(database, "points-integrity-user");
    await database.pointAccount.update({ where: { userId: user.id }, data: { balance: 1 } });
    await expect(getPointOverview(database, { userId: user.id })).rejects.toBeInstanceOf(
      PointLedgerIntegrityError,
    );
    const completedAt = new Date("2026-09-12T04:00:05.000Z");
    const sessionId = await createPlayingSession(user.id, completedAt);

    await expect(
      completeGameSessionTransaction(database, {
        userId: user.id,
        sessionId,
        completion: { clientElapsedMs: 4_000, events: validEvents() },
        now: completedAt,
      }),
    ).rejects.toBeInstanceOf(PointLedgerIntegrityError);
    expect(await database.gameRecord.count({ where: { sessionId } })).toBe(0);
    expect(await database.gameSession.findUnique({ where: { id: sessionId } })).toMatchObject({
      status: "PLAYING",
    });
  });

  it("DB가 음수 잔액과 같은 기록의 중복 적립을 거부한다", async () => {
    const user = await createTestUser(database, "points-constraint-user");
    await expect(
      database.pointAccount.update({ where: { userId: user.id }, data: { balance: -1 } }),
    ).rejects.toBeDefined();

    const completed = await completeAt(user.id, new Date("2026-09-12T05:00:05.000Z"));
    await expect(
      database.pointTransaction.create({
        data: {
          accountUserId: user.id,
          type: "EARN",
          reason: "NUMBER_CLICK_COMPLETION",
          amount: 10,
          balanceAfter: 20,
          gameRecordId: completed.recordId,
          policyVersion: "number-click-completion-v1",
          idempotencyKey: `duplicate-${randomUUID()}`,
          createdAt: new Date("2026-09-12T05:00:06.000Z"),
        },
      }),
    ).rejects.toBeDefined();
  });
});
