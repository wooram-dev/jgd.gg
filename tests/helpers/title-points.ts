import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { NUMBER_CLICK_RULES_SNAPSHOT } from "@/features/number-click/domain/rules";

// Test fixtures only: valid 10P entries, at most five per KST day; no production top-up API.
export async function fundTitleTestUser(database: PrismaClient, userId: string, points: number) {
  if (points % 10 || points < 0)
    throw new Error("Fixture points must be a nonnegative multiple of ten.");
  const game = await database.game.upsert({
    where: { slug: "number-click" },
    update: {},
    create: {
      slug: "number-click",
      displayName: "숫자 순서대로 누르기",
      description: "fixture",
      status: "ACTIVE",
      scoreDirection: "ASC",
      scoreUnit: "MILLISECONDS",
      currentRulesVersion: 1,
      rankedRulesVersion: 1,
    },
  });
  const records = Array.from({ length: points / 10 }, (_, index) => {
    const achievedAt = new Date(
      Date.now() -
        (Math.ceil(points / 50) + 1) * 86_400_000 +
        Math.floor(index / 5) * 86_400_000 +
        (index % 5) * 10_000,
    );
    return { id: randomUUID(), sessionId: randomUUID(), achievedAt, index };
  });
  await database.$transaction(async (tx) => {
    await tx.gameSession.createMany({
      data: records.map((record) => ({
        id: record.sessionId,
        userId,
        gameId: game.id,
        status: "COMPLETED",
        idempotencyKey: randomUUID(),
        rulesVersion: 1,
        rulesSnapshot: NUMBER_CLICK_RULES_SNAPSHOT,
        challengeData: { schemaVersion: 1, board: Array.from({ length: 25 }, (_, i) => i + 1) },
        createdAt: new Date(record.achievedAt.getTime() - 5_000),
        readyExpiresAt: new Date(record.achievedAt.getTime() + 55_000),
        startedAt: new Date(record.achievedAt.getTime() - 4_000),
        expiresAt: new Date(record.achievedAt.getTime() + 296_000),
        completedAt: record.achievedAt,
      })),
    });
    await tx.gameRecord.createMany({
      data: records.map((record) => ({
        id: record.id,
        sessionId: record.sessionId,
        userId,
        gameId: game.id,
        rulesVersion: 1,
        durationMs: 4_000,
        mistakeCount: 0,
        penaltyMs: 0,
        scoreValue: 4_000,
        clickCount: 25,
        serverElapsedMs: 4_000,
        achievedAt: record.achievedAt,
        resultData: {
          schemaVersion: 2,
          pointAward: {
            status: "AWARDED",
            amount: 10,
            policyVersion: "number-click-completion-v1",
          },
        },
      })),
    });
    await tx.pointTransaction.createMany({
      data: records.map((record) => ({
        accountUserId: userId,
        type: "EARN",
        reason: "NUMBER_CLICK_COMPLETION",
        amount: 10,
        balanceAfter: (record.index + 1) * 10,
        gameRecordId: record.id,
        policyVersion: "number-click-completion-v1",
        idempotencyKey: `game-record:${record.id}:earn`,
        createdAt: record.achievedAt,
      })),
    });
    await tx.pointAccount.update({ where: { userId }, data: { balance: points } });
  });
}
