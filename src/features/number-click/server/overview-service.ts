import type { PrismaClient } from "@/generated/prisma/client";

import { getNumberClickRanking } from "../../ranking/server/ranking-service";
import { NUMBER_CLICK_RULES, NUMBER_CLICK_SLUG } from "../domain/rules";
import { getNumberClickStats } from "./stats-service";

export async function getNumberClickOverview(
  database: PrismaClient,
  input: { viewerId: string | null; now?: Date },
) {
  const game = await database.game.findUnique({ where: { slug: NUMBER_CLICK_SLUG } });
  if (!game || game.status !== "ACTIVE") {
    return null;
  }

  const [todayRanking, viewerStats, viewer] = await Promise.all([
    getNumberClickRanking(database, {
      period: "today",
      limit: 1,
      offset: 0,
      viewerId: input.viewerId,
      now: input.now,
    }),
    input.viewerId
      ? getNumberClickStats(database, { userId: input.viewerId, now: input.now })
      : null,
    input.viewerId
      ? database.user.findUnique({
          where: { id: input.viewerId },
          select: { discordDisplayName: true, image: true },
        })
      : null,
  ]);

  return {
    game: {
      slug: game.slug,
      name: game.displayName,
      status: game.status,
      rules: {
        version: NUMBER_CLICK_RULES.version,
        boardSize: NUMBER_CLICK_RULES.boardSize,
        maxNumber: NUMBER_CLICK_RULES.maxNumber,
        penaltyPerMistakeMs: NUMBER_CLICK_RULES.penaltyPerMistakeMs,
        minimumDurationMs: NUMBER_CLICK_RULES.minimumDurationMs,
        maximumDurationMs: NUMBER_CLICK_RULES.maximumDurationMs,
      },
    },
    todayBest: todayRanking?.items[0]
      ? {
          displayName: todayRanking.items[0].displayName,
          avatarUrl: todayRanking.items[0].avatarUrl,
          finalMs: todayRanking.items[0].finalMs,
          mistakeCount: todayRanking.items[0].mistakeCount,
        }
      : null,
    viewer: viewer
      ? {
          displayName: viewer.discordDisplayName,
          avatarUrl: viewer.image,
          personalBest: viewerStats?.best.all ?? null,
        }
      : null,
  };
}
