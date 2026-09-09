import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getRankingPeriod, type RankingPeriodKey } from "@/lib/time/ranking-period";

import { NUMBER_CLICK_SLUG } from "../domain/rules";

const bestOrder: Prisma.GameRecordOrderByWithRelationInput[] = [
  { scoreValue: "asc" },
  { mistakeCount: "asc" },
  { achievedAt: "asc" },
  { id: "asc" },
];

function mapRecord(record: {
  scoreValue: number;
  durationMs: number;
  mistakeCount: number;
  penaltyMs: number;
  achievedAt: Date;
}) {
  return {
    finalMs: record.scoreValue,
    durationMs: record.durationMs,
    mistakeCount: record.mistakeCount,
    penaltyMs: record.penaltyMs,
    achievedAt: record.achievedAt.toISOString(),
  };
}

export async function getNumberClickStats(
  database: PrismaClient,
  input: { userId: string; now?: Date },
) {
  const game = await database.game.findUnique({ where: { slug: NUMBER_CLICK_SLUG } });
  if (!game) {
    return null;
  }

  const now = input.now ?? new Date();
  const getBest = async (periodKey: RankingPeriodKey) => {
    const period = getRankingPeriod(periodKey, now);
    const periodWhere =
      period.startsAt && period.endsAt
        ? { achievedAt: { gte: period.startsAt, lt: period.endsAt } }
        : {};
    return database.gameRecord.findFirst({
      where: {
        userId: input.userId,
        gameId: game.id,
        rulesVersion: game.rankedRulesVersion,
        rankEligible: true,
        ...periodWhere,
      },
      orderBy: bestOrder,
      select: {
        scoreValue: true,
        durationMs: true,
        mistakeCount: true,
        penaltyMs: true,
        achievedAt: true,
      },
    });
  };

  const [completedPlayCount, allBest, todayBest, weekBest, recent] = await Promise.all([
    database.gameRecord.count({ where: { userId: input.userId, gameId: game.id } }),
    getBest("all"),
    getBest("today"),
    getBest("week"),
    database.gameRecord.findMany({
      where: { userId: input.userId, gameId: game.id },
      orderBy: { achievedAt: "desc" },
      take: 10,
      select: {
        scoreValue: true,
        durationMs: true,
        mistakeCount: true,
        penaltyMs: true,
        achievedAt: true,
      },
    }),
  ]);

  return {
    gameSlug: NUMBER_CLICK_SLUG,
    completedPlayCount,
    best: {
      all: allBest ? mapRecord(allBest) : null,
      today: todayBest ? mapRecord(todayBest) : null,
      week: weekBest ? mapRecord(weekBest) : null,
    },
    recent: recent.map(mapRecord),
  };
}
