import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import {
  getRankingPeriod,
  type RankingPeriodKey,
  SERVICE_TIME_ZONE,
} from "@/lib/time/ranking-period";

import { NUMBER_CLICK_SLUG } from "../../number-click/domain/rules";
import type { RankingData, RankingItem } from "../schemas/response";

type RawRankingRow = {
  rank: bigint;
  recordId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  finalMs: number;
  mistakeCount: number;
  achievedAt: Date;
};

function rankingCte(
  gameId: string,
  rulesVersion: number,
  startsAt: Date | null,
  endsAt: Date | null,
) {
  const periodFilter =
    startsAt && endsAt
      ? Prisma.sql`AND r."achieved_at" >= ${startsAt} AND r."achieved_at" < ${endsAt}`
      : Prisma.empty;

  return Prisma.sql`
    WITH eligible AS (
      SELECT
        r.*,
        ROW_NUMBER() OVER (
          PARTITION BY r."user_id"
          ORDER BY r."score_value" ASC, r."mistake_count" ASC, r."achieved_at" ASC, r."id" ASC
        ) AS user_best_no
      FROM "game_record" r
      JOIN "user" u ON u."id" = r."user_id"
      WHERE r."game_id" = ${gameId}::uuid
        AND r."rules_version" = ${rulesVersion}
        AND r."rank_eligible" = true
        AND u."status" = 'ACTIVE'
        ${periodFilter}
    ), ranked AS (
      SELECT
        eligible.*,
        ROW_NUMBER() OVER (
          ORDER BY "score_value" ASC, "mistake_count" ASC, "achieved_at" ASC, "id" ASC
        ) AS rank
      FROM eligible
      WHERE user_best_no = 1
    )`;
}

function mapRankingRow(row: RawRankingRow, viewerId: string | null): RankingItem {
  return {
    rank: Number(row.rank),
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    finalMs: row.finalMs,
    mistakeCount: row.mistakeCount,
    achievedAt: row.achievedAt.toISOString(),
    isViewer: row.userId === viewerId,
  };
}

export async function getNumberClickRanking(
  database: PrismaClient,
  input: {
    period: RankingPeriodKey;
    limit: number;
    offset: number;
    viewerId: string | null;
    now?: Date;
  },
): Promise<RankingData | null> {
  const game = await database.game.findUnique({ where: { slug: NUMBER_CLICK_SLUG } });
  if (!game) {
    return null;
  }

  const period = getRankingPeriod(input.period, input.now ?? new Date());
  const cte = rankingCte(game.id, game.rankedRulesVersion, period.startsAt, period.endsAt);
  const rows = await database.$queryRaw<RawRankingRow[]>(Prisma.sql`
    ${cte}
    SELECT
      ranked.rank,
      ranked."id" AS "recordId",
      ranked."user_id" AS "userId",
      u."discord_display_name" AS "displayName",
      u."image" AS "avatarUrl",
      ranked."score_value" AS "finalMs",
      ranked."mistake_count" AS "mistakeCount",
      ranked."achieved_at" AS "achievedAt"
    FROM ranked
    JOIN "user" u ON u."id" = ranked."user_id"
    ORDER BY ranked.rank
    LIMIT ${input.limit + 1} OFFSET ${input.offset}
  `);

  let viewer: RankingItem | null = null;
  if (input.viewerId) {
    const viewerRows = await database.$queryRaw<RawRankingRow[]>(Prisma.sql`
      ${cte}
      SELECT
        ranked.rank,
        ranked."id" AS "recordId",
        ranked."user_id" AS "userId",
        u."discord_display_name" AS "displayName",
        u."image" AS "avatarUrl",
        ranked."score_value" AS "finalMs",
        ranked."mistake_count" AS "mistakeCount",
        ranked."achieved_at" AS "achievedAt"
      FROM ranked
      JOIN "user" u ON u."id" = ranked."user_id"
      WHERE ranked."user_id" = ${input.viewerId}
    `);
    viewer = viewerRows[0] ? mapRankingRow(viewerRows[0], input.viewerId) : null;
  }

  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit).map((row) => mapRankingRow(row, input.viewerId));
  return {
    gameSlug: NUMBER_CLICK_SLUG,
    period: {
      key: period.key,
      timeZone: SERVICE_TIME_ZONE,
      startsAt: period.startsAt?.toISOString() ?? null,
      endsAt: period.endsAt?.toISOString() ?? null,
    },
    items,
    viewer,
    pagination: {
      limit: input.limit,
      offset: input.offset,
      returned: items.length,
      hasMore,
    },
  };
}
