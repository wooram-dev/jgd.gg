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
  const viewerFilter = input.viewerId
    ? Prisma.sql`OR ranked."user_id" = ${input.viewerId}`
    : Prisma.empty;
  const pageEnd = input.offset + input.limit;
  // Compute the global rank once for both the page and viewer. Keep one extra
  // page row for hasMore; a viewer outside that range must not affect pagination.
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
    WHERE (ranked.rank > ${input.offset} AND ranked.rank <= ${pageEnd + 1})
      ${viewerFilter}
    ORDER BY ranked.rank
  `);

  const viewerRow = rows.find((row) => row.userId === input.viewerId);
  const viewer = viewerRow ? mapRankingRow(viewerRow, input.viewerId) : null;
  const hasMore = rows.some((row) => Number(row.rank) === pageEnd + 1);
  const items = rows
    .filter((row) => Number(row.rank) > input.offset && Number(row.rank) <= pageEnd)
    .map((row) => mapRankingRow(row, input.viewerId));
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
