import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { NUMBER_CLICK_RULES_SNAPSHOT } from "@/features/number-click/domain/rules";
import { getNumberClickRanking } from "@/features/ranking/server/ranking-service";
import type { PrismaClient } from "@/generated/prisma/client";
import { cleanApplicationData, createTestDatabase, createTestUser } from "../../helpers/database";

const database = createTestDatabase();
const board = Array.from({ length: 25 }, (_, index) => index + 1);

async function createRankingRecord(
  databaseClient: PrismaClient,
  input: {
    userId: string;
    achievedAt: Date;
    scoreValue: number;
    mistakeCount?: number;
    rankEligible?: boolean;
    rulesVersion?: number;
    recordId?: string;
  },
) {
  const game = await databaseClient.game.findUniqueOrThrow({ where: { slug: "number-click" } });
  const mistakeCount = input.mistakeCount ?? 0;
  const penaltyMs = mistakeCount * 500;
  const durationMs = input.scoreValue - penaltyMs;
  const createdAt = new Date(input.achievedAt.getTime() - 5_000);
  const startedAt = new Date(input.achievedAt.getTime() - 4_000);
  const session = await databaseClient.gameSession.create({
    data: {
      userId: input.userId,
      gameId: game.id,
      status: "COMPLETED",
      idempotencyKey: randomUUID(),
      rulesVersion: input.rulesVersion ?? 1,
      rulesSnapshot: NUMBER_CLICK_RULES_SNAPSHOT,
      challengeData: { schemaVersion: 1, board },
      createdAt,
      readyExpiresAt: new Date(createdAt.getTime() + 60_000),
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 300_000),
      completedAt: input.achievedAt,
    },
  });

  return databaseClient.gameRecord.create({
    data: {
      id: input.recordId,
      sessionId: session.id,
      userId: input.userId,
      gameId: game.id,
      rulesVersion: input.rulesVersion ?? 1,
      durationMs,
      mistakeCount,
      penaltyMs,
      scoreValue: input.scoreValue,
      clickCount: 25 + mistakeCount,
      serverElapsedMs: 4_000,
      resultData: { schemaVersion: 1, validationVersion: 1, boardDigest: "fixture" },
      achievedAt: input.achievedAt,
      rankEligible: input.rankEligible ?? true,
    },
  });
}

beforeEach(async () => {
  await cleanApplicationData(database);
});

afterAll(async () => {
  await database.$disconnect();
});

describe("number-click PostgreSQL ranking", () => {
  it("KST 오늘·주간의 [startsAt, endsAt) 경계만 포함한다", async () => {
    const now = new Date("2026-09-06T03:00:00.000Z");
    const todayStart = new Date("2026-09-05T15:00:00.000Z");
    const todayEnd = new Date("2026-09-06T15:00:00.000Z");
    const before = await createTestUser(database, "boundary-before", { displayName: "Before" });
    const start = await createTestUser(database, "boundary-start", { displayName: "Start" });
    const inside = await createTestUser(database, "boundary-inside", { displayName: "Inside" });
    const end = await createTestUser(database, "boundary-end", { displayName: "End" });

    await createRankingRecord(database, {
      userId: before.id,
      achievedAt: new Date(todayStart.getTime() - 1),
      scoreValue: 3_500,
    });
    await createRankingRecord(database, {
      userId: start.id,
      achievedAt: todayStart,
      scoreValue: 4_000,
    });
    await createRankingRecord(database, {
      userId: inside.id,
      achievedAt: new Date("2026-09-06T03:00:00.000Z"),
      scoreValue: 4_500,
    });
    await createRankingRecord(database, {
      userId: end.id,
      achievedAt: todayEnd,
      scoreValue: 3_000,
    });

    const today = await getNumberClickRanking(database, {
      period: "today",
      limit: 100,
      offset: 0,
      viewerId: null,
      now,
    });
    const week = await getNumberClickRanking(database, {
      period: "week",
      limit: 100,
      offset: 0,
      viewerId: null,
      now,
    });
    const all = await getNumberClickRanking(database, {
      period: "all",
      limit: 100,
      offset: 0,
      viewerId: null,
      now,
    });

    expect(today?.items.map((item) => item.displayName)).toEqual(["Start", "Inside"]);
    expect(today?.period).toMatchObject({
      startsAt: todayStart.toISOString(),
      endsAt: todayEnd.toISOString(),
    });
    expect(week?.items.map((item) => item.displayName)).toEqual(["Before", "Start", "Inside"]);
    expect(all?.items.map((item) => item.displayName)).toEqual([
      "End",
      "Before",
      "Start",
      "Inside",
    ]);
    expect(today?.viewer).toBeNull();
  });

  it("사용자별 최고 한 건과 ACTIVE·eligible·현재 rules 기록만 포함한다", async () => {
    const achievedAt = new Date("2026-09-06T03:00:00.000Z");
    const active = await createTestUser(database, "eligible-active", { displayName: "Active" });
    const banned = await createTestUser(database, "excluded-banned", {
      displayName: "Banned",
      status: "BANNED",
    });
    const invalidated = await createTestUser(database, "excluded-invalid", {
      displayName: "Invalidated",
    });
    const oldRules = await createTestUser(database, "excluded-rules", { displayName: "Old rules" });

    await createRankingRecord(database, { userId: active.id, achievedAt, scoreValue: 6_000 });
    await createRankingRecord(database, {
      userId: active.id,
      achievedAt: new Date(achievedAt.getTime() + 1_000),
      scoreValue: 5_000,
    });
    await createRankingRecord(database, { userId: banned.id, achievedAt, scoreValue: 3_000 });
    await createRankingRecord(database, {
      userId: invalidated.id,
      achievedAt,
      scoreValue: 3_100,
      rankEligible: false,
    });
    await createRankingRecord(database, {
      userId: oldRules.id,
      achievedAt,
      scoreValue: 3_200,
      rulesVersion: 2,
    });

    const ranking = await getNumberClickRanking(database, {
      period: "all",
      limit: 100,
      offset: 0,
      viewerId: active.id,
      now: achievedAt,
    });

    expect(ranking?.items).toHaveLength(1);
    expect(ranking?.items[0]).toMatchObject({
      rank: 1,
      displayName: "Active",
      finalMs: 5_000,
      isViewer: true,
    });
    expect(ranking?.viewer).toEqual(ranking?.items[0]);
  });

  it("score·mistake·achievedAt·record id 순으로 결정적으로 정렬한다", async () => {
    const baseTime = new Date("2026-09-06T03:00:00.000Z");
    const fixtures = [
      {
        userId: "order-score",
        displayName: "Score",
        scoreValue: 3_999,
        mistakeCount: 0,
        achievedAt: baseTime,
      },
      {
        userId: "order-early",
        displayName: "Early",
        scoreValue: 4_000,
        mistakeCount: 0,
        achievedAt: new Date(baseTime.getTime() - 1_000),
      },
      {
        userId: "order-id-low",
        displayName: "Id low",
        scoreValue: 4_000,
        mistakeCount: 0,
        achievedAt: baseTime,
        recordId: "00000000-0000-4000-8000-000000000001",
      },
      {
        userId: "order-id-high",
        displayName: "Id high",
        scoreValue: 4_000,
        mistakeCount: 0,
        achievedAt: baseTime,
        recordId: "00000000-0000-4000-8000-000000000002",
      },
      {
        userId: "order-late",
        displayName: "Late",
        scoreValue: 4_000,
        mistakeCount: 0,
        achievedAt: new Date(baseTime.getTime() + 1_000),
      },
      {
        userId: "order-mistake",
        displayName: "Mistake",
        scoreValue: 4_000,
        mistakeCount: 1,
        achievedAt: new Date(baseTime.getTime() - 2_000),
      },
    ];
    for (const fixture of fixtures) {
      const user = await createTestUser(database, fixture.userId, {
        displayName: fixture.displayName,
      });
      await createRankingRecord(database, { ...fixture, userId: user.id });
    }

    const ranking = await getNumberClickRanking(database, {
      period: "all",
      limit: 100,
      offset: 0,
      viewerId: "order-id-high",
      now: baseTime,
    });

    expect(ranking?.items.map((item) => item.displayName)).toEqual([
      "Score",
      "Early",
      "Id low",
      "Id high",
      "Late",
      "Mistake",
    ]);
    expect(ranking?.items.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ranking?.viewer).toEqual(ranking?.items[3]);
  });

  it("top 100 밖 viewer도 전체 순위와 함께 반환한다", async () => {
    const game = await database.game.findUniqueOrThrow({ where: { slug: "number-click" } });
    const achievedAt = new Date("2026-09-06T03:00:00.000Z");
    const createdAt = new Date(achievedAt.getTime() - 5_000);
    const startedAt = new Date(achievedAt.getTime() - 4_000);
    const users = Array.from({ length: 101 }, (_, index) => ({
      id: `viewer-${String(index + 1).padStart(3, "0")}`,
      name: `Viewer ${index + 1}`,
      email: `viewer-${index + 1}@discord.placeholder.invalid`,
      emailVerified: false,
      discordUsername: `viewer-${index + 1}`,
      discordDisplayName: `Viewer ${index + 1}`,
      profileUpdatedAt: achievedAt,
    }));
    const sessions = users.map((user) => ({
      id: randomUUID(),
      userId: user.id,
      gameId: game.id,
      status: "COMPLETED" as const,
      idempotencyKey: randomUUID(),
      rulesVersion: 1,
      rulesSnapshot: NUMBER_CLICK_RULES_SNAPSHOT,
      challengeData: { schemaVersion: 1, board },
      createdAt,
      readyExpiresAt: new Date(createdAt.getTime() + 60_000),
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 300_000),
      completedAt: achievedAt,
    }));
    await database.user.createMany({ data: users });
    await database.gameSession.createMany({ data: sessions });
    await database.gameRecord.createMany({
      data: sessions.map((session, index) => ({
        sessionId: session.id,
        userId: session.userId,
        gameId: game.id,
        rulesVersion: 1,
        durationMs: 4_000 + index,
        mistakeCount: 0,
        penaltyMs: 0,
        scoreValue: 4_000 + index,
        clickCount: 25,
        serverElapsedMs: 4_000,
        resultData: { schemaVersion: 1, validationVersion: 1, boardDigest: "fixture" },
        achievedAt,
      })),
    });

    const ranking = await getNumberClickRanking(database, {
      period: "all",
      limit: 100,
      offset: 0,
      viewerId: "viewer-101",
      now: achievedAt,
    });

    expect(ranking?.items).toHaveLength(100);
    expect(ranking?.items.at(-1)?.rank).toBe(100);
    expect(ranking?.items.some((item) => item.isViewer)).toBe(false);
    expect(ranking?.viewer).toMatchObject({
      rank: 101,
      displayName: "Viewer 101",
      finalMs: 4_100,
      isViewer: true,
    });
    expect(ranking?.pagination).toEqual({ limit: 100, offset: 0, returned: 100, hasMore: true });
  });

  it("후보 기록이 없으면 빈 목록과 null viewer를 반환한다", async () => {
    const ranking = await getNumberClickRanking(database, {
      period: "all",
      limit: 100,
      offset: 0,
      viewerId: "missing-viewer",
      now: new Date("2026-09-06T03:00:00.000Z"),
    });

    expect(ranking?.items).toEqual([]);
    expect(ranking?.viewer).toBeNull();
    expect(ranking?.pagination).toEqual({ limit: 100, offset: 0, returned: 0, hasMore: false });
  });
});
